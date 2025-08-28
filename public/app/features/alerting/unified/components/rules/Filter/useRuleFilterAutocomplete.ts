import { useCallback, useMemo } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { ComboboxOption } from '@grafana/ui';
import { GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { featureDiscoveryApi } from '../../../api/featureDiscoveryApi';
import { prometheusApi } from '../../../api/prometheusApi';
import { shouldUsePrometheusRulesPrimary } from '../../../featureToggles';
import { GRAFANA_RULES_SOURCE_NAME, getRulesDataSources } from '../../../utils/datasource';

export function useNamespaceAndGroupOptions(): {
  namespaceOptions: (inputValue: string) => Promise<Array<ComboboxOption<string>>>;
  allGroupNames: string[];
  isLoadingNamespaces: boolean;
  namespacePlaceholder: string;
  groupPlaceholder: string;
} {
  const [fetchGrafanaGroups] = prometheusApi.useLazyGetGrafanaGroupsQuery();
  const [fetchExternalGroups] = prometheusApi.useLazyGetGroupsQuery();

  const externalDataSources = useMemo(
    () => getRulesDataSources().filter((ds: DataSourceInstanceSettings) => !!ds?.url),
    []
  );
  const collator = useMemo(() => new Intl.Collator(), []);

  const formatNamespaceOption = useCallback((namespaceName: string): ComboboxOption<string> => {
    if (namespaceName.includes('/') && (namespaceName.endsWith('.yml') || namespaceName.endsWith('.yaml'))) {
      const filename = namespaceName.split('/').pop() || namespaceName;
      const maxDescriptionLength = 100;
      const truncatedDescription =
        namespaceName.length > maxDescriptionLength
          ? `${namespaceName.substring(0, maxDescriptionLength)}...`
          : namespaceName;
      return { label: filename, value: namespaceName, description: truncatedDescription };
    }

    const maxLength = 50;
    const maxDescriptionLength = 100;
    const truncatedName =
      namespaceName.length > maxLength ? `${namespaceName.substring(0, maxLength)}...` : namespaceName;
    const truncatedDescription =
      namespaceName.length > maxDescriptionLength
        ? `${namespaceName.substring(0, maxDescriptionLength)}...`
        : namespaceName;
    return { label: truncatedName, value: namespaceName, description: truncatedDescription };
  }, []);

  const namespaceOptions = useCallback(
    async (inputValue: string) => {
      // Grafana namespaces
      const grafanaResponse = await fetchGrafanaGroups({ limitAlerts: 0, groupLimit: 1000 }).unwrap();
      const grafanaFolders: Array<ComboboxOption<string>> = Array.from(
        new Set(grafanaResponse.data.groups.map((g: GrafanaPromRuleGroupDTO) => g.file || 'default'))
      )
        .map((name) => ({
          label: name,
          value: name,
          description: t('alerting.rules-filter.grafana-folder', 'Grafana folder'),
        }))
        .sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));

      // External namespaces
      const namespaceNameSet = new Set<string>();
      const calls = externalDataSources.map((ds) =>
        fetchExternalGroups({
          ruleSource: { uid: ds.uid },
          excludeAlerts: true,
          groupLimit: 500,
          notificationOptions: { showErrorAlert: false },
        }).unwrap()
      );
      const results = await Promise.allSettled(calls);
      for (const res of results) {
        if (res.status === 'fulfilled') {
          res.value.data.groups.forEach((group: { file?: string }) => namespaceNameSet.add(group.file || 'default'));
        }
      }
      const externalNamespaces = Array.from(namespaceNameSet)
        .map(formatNamespaceOption)
        .sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));

      const options = [...grafanaFolders, ...externalNamespaces];
      const filtered = filterBySearch(options, inputValue);
      return filtered;
    },
    [fetchGrafanaGroups, fetchExternalGroups, externalDataSources, formatNamespaceOption, collator]
  );

  const allGroupNames: string[] = [];
  const isLoadingNamespaces = false;
  const namespacePlaceholder = t('alerting.rules-filter.filter-options.placeholder-namespace', 'Select namespace');
  const groupPlaceholder = t('grafana.select-group', 'Select group');

  return { namespaceOptions, allGroupNames, isLoadingNamespaces, namespacePlaceholder, groupPlaceholder };
}

export function useLabelOptions(): {
  labelOptions: (inputValue: string) => Promise<Array<ComboboxOption<string>>>;
} {
  // Use lazy queries so we only fetch when the dropdown is opened or the user types
  const prometheusRulesPrimary = shouldUsePrometheusRulesPrimary();
  const [discoverDsFeatures] = featureDiscoveryApi.useLazyDiscoverDsFeaturesQuery();
  const [fetchPromNamespaces] = alertRuleApi.useLazyPrometheusRuleNamespacesQuery();
  const [fetchRulerRules] = alertRuleApi.useLazyRulerRulesQuery();
  const collator = useMemo(() => new Intl.Collator(), []);

  const createInfoOption = useCallback((): ComboboxOption<string> => {
    return {
      label: t('label-dropdown-info', "Can't find your label? Enter it manually"),
      value: '__GRAFANA_LABEL_DROPDOWN_INFO__',
      infoOption: true,
    };
  }, []);

  const toOptions = useCallback(
    (labelsMap: Map<string, Set<string>>): Array<ComboboxOption<string>> => {
      const selectable: Array<ComboboxOption<string>> = Array.from(labelsMap.entries()).flatMap(([key, values]) =>
        Array.from(values).map<ComboboxOption<string>>((value) => ({
          label: `${key}=${value}`,
          value: `${key}=${value}`,
        }))
      );

      selectable.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));
      return selectable;
    },
    [collator]
  );

  const labelOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      // Fetch labels from the appropriate source lazily
      let labelsMap = new Map<string, Set<string>>();

      if (prometheusRulesPrimary) {
        const namespaces = await fetchPromNamespaces({
          ruleSourceName: GRAFANA_RULES_SOURCE_NAME,
        }).unwrap();
        labelsMap = namespacesToLabels(namespaces);
      } else {
        const features = await discoverDsFeatures({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }, true).unwrap();
        if (!features?.rulerConfig) {
          return [];
        }
        const rulerRules = await fetchRulerRules({
          rulerConfig: features.rulerConfig,
        }).unwrap();
        labelsMap = rulerRulesToLabels(rulerRules);
      }

      const selectable = toOptions(labelsMap);
      if (selectable.length === 0) {
        return [];
      }

      const options = [...selectable, createInfoOption()];
      return filterBySearch(options, inputValue, true);
    },
    [prometheusRulesPrimary, fetchPromNamespaces, discoverDsFeatures, fetchRulerRules, toOptions, createInfoOption]
  );

  return { labelOptions };
}

export function useAlertingDataSourceOptions(): (inputValue: string) => Promise<Array<ComboboxOption<string>>> {
  return useCallback(async (inputValue: string) => {
    const options = getDataSourceSrv()
      .getList({ alerting: true })
      .map((ds: DataSourceInstanceSettings) => ({ label: ds.name, value: ds.name }));
    return filterBySearch(options, inputValue);
  }, []);
}

// Helpers to build labels map from namespaces / ruler rules
function namespacesToLabels(
  promNamespaces: Array<{
    groups: Array<{ rules: Array<{ labels?: Record<string, string> }> }>;
  }>
) {
  const rules = promNamespaces.flatMap((ns) => ns.groups).flatMap((group) => group.rules);

  return rules.reduce((result, rule) => {
    if (!rule.labels) {
      return result;
    }

    Object.entries(rule.labels).forEach(([labelKey, labelValue]) => {
      if (!labelKey || !labelValue) {
        return;
      }
      const existing = result.get(labelKey);
      if (existing) {
        existing.add(labelValue);
      } else {
        result.set(labelKey, new Set([labelValue]));
      }
    });

    return result;
  }, new Map<string, Set<string>>());
}

function rulerRulesToLabels(rulerConfig: Record<string, Array<{ rules: Array<{ labels?: Record<string, string> }> }>>) {
  const rules = Object.values(rulerConfig)
    .flatMap((groups) => groups)
    .flatMap((group) => group.rules);

  return rules.reduce((result, rule) => {
    if (!rule.labels) {
      return result;
    }

    Object.entries(rule.labels).forEach(([labelKey, labelValue]) => {
      if (!labelKey || !labelValue) {
        return;
      }
      const existing = result.get(labelKey);
      if (existing) {
        existing.add(labelValue);
      } else {
        result.set(labelKey, new Set([labelValue]));
      }
    });

    return result;
  }, new Map<string, Set<string>>());
}

function filterBySearch(options: Array<ComboboxOption<string>>, inputValue: string, keepInfoOption = false) {
  const search = (inputValue ?? '').toLowerCase();
  if (!search) {
    return options;
  }
  return options.filter(
    (opt) => (opt.label ?? opt.value).toLowerCase().includes(search) || (keepInfoOption && !!opt.infoOption)
  );
}
