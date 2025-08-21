import { useMemo } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../../../api/featureDiscoveryApi';
import { prometheusApi } from '../../../api/prometheusApi';
import { useGetLabelsFromDataSourceName } from '../../../components/rule-editor/useAlertRuleSuggestions';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../../utils/datasource';

export function useNamespaceAndGroupOptions(): {
  namespaceOptions: Array<ComboboxOption<string>>;
  allGroupNames: string[];
  isLoadingNamespaces: boolean;
  namespacePlaceholder: string;
  groupPlaceholder: string;
} {
  const { currentData: grafanaPromRulesResponse, isLoading: isLoadingGrafanaPromRules } =
    prometheusApi.endpoints.getGrafanaGroups.useQuery({
      limitAlerts: 0,
      groupLimit: 1000,
    });

  // Transform Grafana groups to namespace structure
  const grafanaPromRules = useMemo(() => {
    const groups = grafanaPromRulesResponse?.data?.groups ?? [];

    const namespaceMap = new Map<string, { name: string; groups: GrafanaPromRuleGroupDTO[] }>();
    groups.forEach((group) => {
      const namespaceName = group.file || 'default';
      const existing = namespaceMap.get(namespaceName);
      if (existing) {
        existing.groups.push(group);
      } else {
        namespaceMap.set(namespaceName, { name: namespaceName, groups: [group] });
      }
    });

    return Array.from(namespaceMap.values());
  }, [grafanaPromRulesResponse]);

  const { isLoading: isLoadingGrafanaRulerRules } = alertRuleApi.endpoints.rulerRules.useQuery({
    rulerConfig: GRAFANA_RULER_CONFIG,
  });

  const externalDataSources = useMemo(getRulesDataSources, []);

  const externalPromRulesQueries = externalDataSources.map((ds) =>
    prometheusApi.endpoints.getGroups.useQuery({
      ruleSource: { uid: ds.uid },
      excludeAlerts: true,
      groupLimit: 500,
    })
  );

  const isLoadingNamespaces = useMemo(() => {
    return (
      isLoadingGrafanaPromRules ||
      isLoadingGrafanaRulerRules ||
      externalPromRulesQueries.some((query) => query.isLoading)
    );
  }, [isLoadingGrafanaPromRules, isLoadingGrafanaRulerRules, externalPromRulesQueries]);

  const namespaceOptions = useMemo((): Array<ComboboxOption<string>> => {
    const grafanaFolders: Array<ComboboxOption<string>> = [];
    const externalNamespaces: Array<ComboboxOption<string>> = [];

    // Grafana folders
    grafanaPromRules.forEach((namespace) => {
      grafanaFolders.push({
        label: namespace.name,
        value: namespace.name,
        description: t('alerting.rules-filter.grafana-folder', 'Grafana folder'),
      });
    });

    // External namespaces (dedupe by file)
    externalPromRulesQueries.forEach((query) => {
      const namespaces = new Set<string>();
      query.currentData?.data?.groups?.forEach((group) => {
        namespaces.add(group.file || 'default');
      });

      namespaces.forEach((namespaceName) => {
        if (namespaceName.includes('/') && (namespaceName.endsWith('.yml') || namespaceName.endsWith('.yaml'))) {
          const filename = namespaceName.split('/').pop() || namespaceName;
          const maxDescriptionLength = 100;
          const truncatedDescription =
            namespaceName.length > maxDescriptionLength
              ? `${namespaceName.substring(0, maxDescriptionLength)}...`
              : namespaceName;
          externalNamespaces.push({ label: filename, value: namespaceName, description: truncatedDescription });
        } else {
          const maxLength = 50;
          const maxDescriptionLength = 100;
          const truncatedName =
            namespaceName.length > maxLength ? `${namespaceName.substring(0, maxLength)}...` : namespaceName;
          const truncatedDescription =
            namespaceName.length > maxDescriptionLength
              ? `${namespaceName.substring(0, maxDescriptionLength)}...`
              : namespaceName;
          externalNamespaces.push({ label: truncatedName, value: namespaceName, description: truncatedDescription });
        }
      });
    });

    const collator = new Intl.Collator();
    grafanaFolders.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));
    externalNamespaces.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));

    return [...grafanaFolders, ...externalNamespaces];
  }, [grafanaPromRules, externalPromRulesQueries]);

  const allGroupNames = useMemo(() => {
    const groupSet = new Set<string>();
    grafanaPromRules.forEach((namespace) => {
      namespace.groups.forEach((group) => groupSet.add(group.name));
    });
    externalPromRulesQueries.forEach((query) => {
      query.currentData?.data?.groups?.forEach((group) => {
        groupSet.add(group.name);
      });
    });
    return Array.from(groupSet).sort();
  }, [grafanaPromRules, externalPromRulesQueries]);

  const namespacePlaceholder = useMemo(() => {
    if (isLoadingNamespaces) {
      return t('common.loading', 'Loading...');
    }
    if (namespaceOptions.length === 0) {
      return t('alerting.rules-filter.no-namespaces', 'No folders available');
    }
    return t('alerting.rules-filter.filter-options.placeholder-namespace', 'Select namespace');
  }, [isLoadingNamespaces, namespaceOptions.length]);

  const groupPlaceholder = useMemo(() => {
    if (isLoadingNamespaces) {
      return t('common.loading', 'Loading...');
    }
    if (allGroupNames.length === 0) {
      return t('alerting.rules-filter.no-groups', 'No groups available');
    }
    return t('grafana.select-group', 'Select group');
  }, [isLoadingNamespaces, allGroupNames.length]);

  return { namespaceOptions, allGroupNames, isLoadingNamespaces, namespacePlaceholder, groupPlaceholder };
}

export function useLabelOptions(): {
  labelOptions: Array<ComboboxOption<string>>;
  isLoadingGrafanaLabels: boolean;
} {
  const { labels: grafanaLabels, isLoading: isLoadingGrafanaLabels } =
    useGetLabelsFromDataSourceName(GRAFANA_RULES_SOURCE_NAME);

  const labelOptions = useMemo((): Array<ComboboxOption<string>> => {
    const infoOption: ComboboxOption<string> = {
      label: t('label-dropdown-info', "Can't find your label? Enter it manually"),
      value: '__GRAFANA_LABEL_DROPDOWN_INFO__',
      infoOption: true,
    };

    const selectableOptions = Array.from(grafanaLabels.entries())
      .flatMap(([key, values]) =>
        Array.from(values).map((value: string) => ({ label: `${key}=${value}`, value: `${key}=${value}` }))
      )
      .sort((a, b) => new Intl.Collator().compare(a.label, b.label));

    return [...selectableOptions, infoOption];
  }, [grafanaLabels]);

  return { labelOptions, isLoadingGrafanaLabels };
}

export function useAlertingDataSourceOptions(): Array<ComboboxOption<string>> {
  return useMemo(() => {
    return getDataSourceSrv()
      .getList({ alerting: true })
      .map((ds: DataSourceInstanceSettings) => ({ label: ds.name, value: ds.name }));
  }, []);
}
