import { isEmpty } from 'lodash';
import { useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';

import { getBackendSrv } from '@grafana/runtime';
import { FolderDTO } from 'app/types';
import { RulerRulesConfigDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../api/featureDiscoveryApi';
import { Folder } from '../../types/rule-form';
import { useGetRulerRules } from '../rule-editor/useAlertRuleSuggestions';

async function getNestedFoldersIn(uid: string) {
  const response = await lastValueFrom(
    getBackendSrv().fetch<FolderDTO[]>({
      url: `/api/folders`,
      params: { parentUid: uid },
      method: 'GET',
      showErrorAlert: false,
      showSuccessAlert: false,
    })
  );

  return response?.data;
}

export function useGetNestedFolders(folderUID: string, skip = false) {
  const [nestedFolders, setNestedFolders] = useState<FolderDTO[]>([]);

  useEffect(() => {
    (async () => {
      const nestedFoldersIn = skip ? [] : await getNestedFoldersIn(folderUID);
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
function useFilterRulesThatMightBeOverwritten(
  targetNestedFolders: FolderDTO[],
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
      return Object.keys(rulesToBeImported).includes(folder.title);
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
