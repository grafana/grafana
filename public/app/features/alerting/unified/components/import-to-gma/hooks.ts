import { isEmpty } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { type ComboboxOption } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { type RulerCloudRulesConfigDTO, type RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { useAsync } from '../../hooks/useAsync';
import { type Folder } from '../../types/rule-form';
import { useGetNameSpacesByDatasourceName, useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

import { filterRulerRulesConfig } from './useImport';
import { parseYamlFileToRulerRulesConfigDTO } from './yamlToRulerConverter';

function useGetNestedFolders(folderUID: string, skip = false) {
  const [nestedFolders, setNestedFolders] = useState<DashboardQueryResult[]>([]);

  useEffect(() => {
    (async () => {
      const searcher = getGrafanaSearcher();
      const nestedFoldersIn = skip
        ? []
        : (
            await searcher.search({
              kind: ['folder'],
              location: folderUID,
            })
          ).view.toArray();
      setNestedFolders(nestedFoldersIn);
    })();
  }, [folderUID, skip]);

  return nestedFolders;
}

export function useGetRulesThatMightBeOverwritten(
  skip: boolean,
  targetFolder: Folder | undefined,
  rulesToBeImported: RulerRulesConfigDTO
) {
  // get nested folders in the target folder
  const nestedFoldersInTargetFolder = useGetNestedFolders(targetFolder?.uid || '', skip);
  const skipFiltering = skip || nestedFoldersInTargetFolder.length === 0;
  const rulesThatMightBeOverwritten = useFilterRulesThatMightBeOverwritten(
    nestedFoldersInTargetFolder,
    rulesToBeImported,
    skipFiltering
  );

  return { rulesThatMightBeOverwritten };
}

export function useGetRulesToBeImported(skip: boolean, selectedDatasourceName: string | undefined) {
  // we need to skip fetching and filtering if the modal is not open
  const dataSourceToFetch = !skip ? selectedDatasourceName : undefined;
  const { rulerRules: rulesToBeImported, isLoading: isloadingCloudRules } = useGetRulerRules(dataSourceToFetch);

  return { rulesToBeImported, isloadingCloudRules };
}

const EMPTY_RULER_CONFIG: RulerCloudRulesConfigDTO = {};

interface UseRulesToImportArgs {
  rulesSource: 'datasource' | 'yaml';
  rulesDatasourceName: string | null | undefined;
  rulesYamlFile: File | null;
  namespace: string | undefined;
  ruleGroup: string | undefined;
  targetFolder: Folder | undefined;
}

/** The rules the rules step will import, from the chosen source, and the ones in the target folder they might replace. */
export function useRulesToImport({
  rulesSource,
  rulesDatasourceName,
  rulesYamlFile,
  namespace,
  ruleGroup,
  targetFolder,
}: UseRulesToImportArgs) {
  const { rulerRules: rulesFromDatasource } = useGetRulerRules(
    rulesSource === 'datasource' ? (rulesDatasourceName ?? undefined) : undefined
  );

  const yamlFile = rulesSource === 'yaml' ? rulesYamlFile : null;
  const [{ execute: parseYaml }, parseState] = useAsync(async (file: File) => ({
    file,
    config: await parseYamlFileToRulerRulesConfigDTO(file, file.name),
  }));

  useEffect(() => {
    if (yamlFile) {
      // A failed parse lands in parseState.error.
      parseYaml(yamlFile).catch(() => {});
    }
  }, [yamlFile, parseYaml]);

  // The file travels with its rules because the state keeps the previous result while the next one loads.
  const isCurrentYaml = Boolean(yamlFile) && parseState.result?.file === yamlFile;
  const rulesFromYaml = isCurrentYaml ? parseState.result!.config : EMPTY_RULER_CONFIG;
  const rulesError = yamlFile && parseState.status === 'error' ? parseState.error : undefined;
  const isLoadingRules = Boolean(yamlFile) && !isCurrentYaml && !rulesError;

  const { rulesToBeImported, someRulesAreSkipped } = useMemo(() => {
    if (rulesSource === 'datasource') {
      const { filteredConfig, someRulesAreSkipped } = filterRulerRulesConfig(rulesFromDatasource, namespace, ruleGroup);
      return { rulesToBeImported: filteredConfig, someRulesAreSkipped };
    }
    return { rulesToBeImported: rulesFromYaml, someRulesAreSkipped: false };
  }, [rulesSource, rulesFromDatasource, rulesFromYaml, namespace, ruleGroup]);

  const skipOverrideCheck = !targetFolder || isEmpty(rulesToBeImported);
  const { rulesThatMightBeOverwritten } = useGetRulesThatMightBeOverwritten(
    skipOverrideCheck,
    targetFolder,
    rulesToBeImported
  );

  return { rulesToBeImported, someRulesAreSkipped, rulesThatMightBeOverwritten, isLoadingRules, rulesError };
}

/** The namespace and group filter options of the chosen data source. */
export function useNamespaceGroupOptions(
  rulesSource: 'datasource' | 'yaml',
  rulesDatasourceName: string | null | undefined,
  namespace: string | undefined
) {
  const { namespaceGroups, isLoading: isLoadingNamespaces } = useGetNameSpacesByDatasourceName(
    rulesSource === 'datasource' ? (rulesDatasourceName ?? undefined) : undefined
  );

  const namespaceOptions: Array<ComboboxOption<string>> = useMemo(
    () => Array.from(namespaceGroups.keys()).map((ns) => ({ label: ns, value: ns })),
    [namespaceGroups]
  );

  const groupOptions: Array<ComboboxOption<string>> = useMemo(
    () => (namespace && namespaceGroups.get(namespace)?.map((group) => ({ label: group, value: group }))) || [],
    [namespace, namespaceGroups]
  );

  return { namespaceOptions, groupOptions, isLoadingNamespaces };
}

function useFilterRulesThatMightBeOverwritten(
  targetNestedFolders: DashboardQueryResult[],
  rulesToBeImported: RulerRulesConfigDTO,
  skip = true
): RulerRulesConfigDTO {
  const [fetchRulesByFolderUID] = alertRuleApi.endpoints.rulerNamespace.useLazyQuery();
  const [rulesThatMightBeOverwritten, setRulesThatMightBeOverwritten] = useState<RulerRulesConfigDTO>({});

  useEffect(() => {
    if (skip || isEmpty(targetNestedFolders) || isEmpty(rulesToBeImported)) {
      setRulesThatMightBeOverwritten({});
      return;
    }
    // filter targetNestedFolders to only include folders that are in the rulesToBeImported
    const targetNestedFoldersFiltered = targetNestedFolders.filter((folder) => {
      return Object.keys(rulesToBeImported).includes(folder.name);
    });
    const fetchRules = async () => {
      const results: RulerRulesConfigDTO = {};

      await Promise.all(
        targetNestedFoldersFiltered.map(async (folder) => {
          const { data: rules } = await fetchRulesByFolderUID({
            namespace: folder.uid,
            rulerConfig: GRAFANA_RULER_CONFIG,
          });

          if (rules) {
            const folderWithParentTitle = Object.keys(rules)[0];
            if (folderWithParentTitle) {
              results[folderWithParentTitle] = rules[folderWithParentTitle] || [];
            }
          }
        })
      );

      setRulesThatMightBeOverwritten(results);
    };

    fetchRules();
  }, [targetNestedFolders, rulesToBeImported, skip, fetchRulesByFolderUID]);

  return rulesThatMightBeOverwritten;
}
