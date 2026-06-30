import { chain, truncate } from 'lodash';
import { useCallback } from 'react';

import { type DataSourceInstanceSettings, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { type ComboboxOption } from '@grafana/ui';
import { type GrafanaPromRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { prometheusApi } from '../../../api/prometheusApi';
import { getRulesDataSources } from '../../../utils/datasource';

type FetchGrafanaGroups = ReturnType<typeof prometheusApi.useLazyGetGrafanaGroupsQuery>[0];
type FetchExternalGroups = ReturnType<typeof prometheusApi.useLazyGetGroupsQuery>[0];

// Module-scope utilities
const collator = new Intl.Collator();
function getExternalRuleDataSources() {
  return getRulesDataSources().filter((ds: DataSourceInstanceSettings) => !!ds?.url);
}

// Cap on how many groups we fetch per source to keep the request fast. Note this limits
// groups, not namespaces: many groups can share one namespace, so a busy source may yield
// few namespace suggestions even at this cap.
const GROUP_FETCH_LIMIT = 2000;
const MIN_GROUP_SEARCH_CHARACTERS = 3;
const GROUP_SEARCH_LIMIT = 100;
const STATUS_FULFILLED = 'fulfilled';

function createInfoOption(message: string, icon?: IconName): ComboboxOption<string> {
  return {
    label: message,
    value: '__GRAFANA_INFO_OPTION__',
    infoOption: true,
    ...(icon && { icon }),
  };
}

function isYAMLNamespace(namespaceName: string) {
  return namespaceName.includes('/') && (namespaceName.endsWith('.yml') || namespaceName.endsWith('.yaml'));
}

// The combobox doesn't wrap long labels/descriptions, so truncate them to keep options readable.
const LABEL_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 100;

function formatNamespaceOption(namespaceName: string, dataSourceNames: Set<string>): ComboboxOption {
  // The description tells the user which external data source the namespace lives in. The same
  // namespace can appear in several sources, in which case we can't name a single one.
  const sourceName =
    dataSourceNames.size > 1
      ? t('alerting.rules-filter.namespace-multiple-datasources', 'Multiple data sources')
      : (dataSourceNames.values().next().value ?? '');
  const description = truncate(sourceName, { length: DESCRIPTION_MAX_LENGTH });

  if (isYAMLNamespace(namespaceName)) {
    const filename = namespaceName.split('/').pop() || namespaceName;
    return { label: truncate(filename, { length: LABEL_MAX_LENGTH }), value: namespaceName, description };
  }

  return { label: truncate(namespaceName, { length: LABEL_MAX_LENGTH }), value: namespaceName, description };
}

function sortByLabel(options: ComboboxOption[]): ComboboxOption[] {
  return options.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));
}

function toGrafanaFolderOptions(folderNames: string[]): ComboboxOption[] {
  return sortByLabel(
    folderNames.map((name) => ({
      label: name,
      value: name,
      description: t('alerting.rules-filter.grafana-folder', 'Grafana folder'),
    }))
  );
}

function toExternalNamespaceOptions(namespaceSources: Map<string, Set<string>>): ComboboxOption[] {
  return sortByLabel(Array.from(namespaceSources, ([namespace, sources]) => formatNamespaceOption(namespace, sources)));
}

async function fetchGrafanaFolderNames(
  fetchGrafanaGroups: FetchGrafanaGroups,
  searchFolder?: string
): Promise<string[]> {
  try {
    const response = await fetchGrafanaGroups({
      limitAlerts: 0,
      groupLimit: GROUP_FETCH_LIMIT + 1,
      searchFolder: searchFolder || undefined,
    }).unwrap();
    return Array.from(new Set(response.data.groups.map((g: GrafanaPromRuleGroupDTO) => g.file || 'default')));
  } catch (error) {
    console.warn('Failed to load Grafana folders for namespace autocomplete', error);
    return [];
  }
}

async function fetchExternalNamespaceNames(
  fetchExternalGroups: FetchExternalGroups
): Promise<{ externalNamespaces: Map<string, Set<string>>; isLimitReached: boolean }> {
  // Map each namespace to the data source(s) it appears in, so options can show their origin.
  const externalNamespaces = new Map<string, Set<string>>();
  const dataSources = getExternalRuleDataSources();
  const calls = dataSources.map((ds) =>
    fetchExternalGroups({
      ruleSource: { uid: ds.uid },
      excludeAlerts: true,
      groupLimit: GROUP_FETCH_LIMIT + 1,
      notificationOptions: { showErrorAlert: false },
    }).unwrap()
  );
  // Promise.allSettled preserves order, so results[i] belongs to dataSources[i].
  const results = await Promise.allSettled(calls);
  let isLimitReached = false;

  results.forEach((res, i) => {
    if (res.status === STATUS_FULFILLED) {
      const groups = res.value.data.groups;
      isLimitReached = isLimitReached || groups.length > GROUP_FETCH_LIMIT;
      groups.forEach((group: { file?: string }) => {
        const namespace = group.file || 'default';
        const sources = externalNamespaces.get(namespace) ?? new Set<string>();
        sources.add(dataSources[i].name);
        externalNamespaces.set(namespace, sources);
      });
    }
  });
  return { externalNamespaces, isLimitReached };
}

export function useNamespaceAndGroupOptions(): {
  namespaceOptions: (inputValue: string) => Promise<Array<ComboboxOption<string>>>;
  groupOptions: (inputValue: string) => Promise<Array<ComboboxOption<string>>>;
  namespacePlaceholder: string;
  groupPlaceholder: string;
} {
  const [fetchGrafanaGroups] = prometheusApi.useLazyGetGrafanaGroupsQuery();
  const [fetchExternalGroups] = prometheusApi.useLazyGetGroupsQuery();

  const namespaceOptions = useCallback(
    async (inputValue: string) => {
      const [grafanaFolderNames, { externalNamespaces, isLimitReached }] = await Promise.all([
        fetchGrafanaFolderNames(fetchGrafanaGroups, inputValue),
        fetchExternalNamespaceNames(fetchExternalGroups),
      ]);

      // Grafana folders are filtered server-side via `search.folder`. External namespaces have no
      // backend folder search, so they're filtered client-side here.
      const options = [
        ...toGrafanaFolderOptions(grafanaFolderNames),
        ...filterBySearch(toExternalNamespaceOptions(externalNamespaces), inputValue),
      ];

      // When an external source hits the group fetch cap, surface an indicator that its results
      // may be incomplete without discarding the options we did find (Grafana folders are
      // unaffected since they're searched server-side).
      if (isLimitReached) {
        options.unshift(
          createInfoOption(
            t(
              'alerting.rules-filter.namespace-search-incomplete',
              'Due to a large number of groups, search might not be complete in external data sources.'
            ),
            'exclamation-triangle'
          )
        );
      }

      return options;
    },
    [fetchGrafanaGroups, fetchExternalGroups]
  );

  const groupOptions = useCallback(
    async (inputValue: string) => {
      const trimmedInput = inputValue?.trim() || '';
      if (trimmedInput.length < MIN_GROUP_SEARCH_CHARACTERS) {
        return [
          createInfoOption(
            t('alerting.rules-filter.group-search-prompt', 'Type at least 3 characters to search groups')
          ),
        ];
      }

      try {
        // Use the backend search with lightweight response
        const grafanaResponse = await fetchGrafanaGroups({
          limitAlerts: 0, // Lightweight - no alert data
          searchGroupName: trimmedInput, // Backend filtering via search.rule_group parameter
          groupLimit: GROUP_SEARCH_LIMIT, // Reasonable limit for dropdown results
        }).unwrap();

        // Deduplicate group names
        const groupNames = chain(grafanaResponse.data.groups).map('name').compact().uniq().value();

        // No results found
        if (groupNames.length === 0) {
          return [
            createInfoOption(
              t('alerting.rules-filter.group-no-results', 'No groups found matching "{{search}}"', {
                search: trimmedInput,
              })
            ),
          ];
        }

        const options: Array<ComboboxOption<string>> = groupNames
          .map((name) => ({ label: name, value: name }))
          .sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));

        return options;
      } catch (error) {
        console.error('Error fetching groups:', error);
        return [createInfoOption(t('alerting.rules-filter.group-search-error', 'Error searching groups'))];
      }
    },
    [fetchGrafanaGroups]
  );

  const namespacePlaceholder = t('alerting.rules-filter.filter-options.placeholder-namespace', 'Select namespace');
  const groupPlaceholder = t('alerting.rules-filter.placeholder-group-search', 'Search group');

  return { namespaceOptions, groupOptions, namespacePlaceholder, groupPlaceholder };
}

export function useLabelOptions(): {
  labelOptions: (inputValue: string) => Promise<Array<ComboboxOption<string>>>;
} {
  // Use lazy queries so we only fetch when the dropdown is opened or the user types
  const [fetchGrafanaGroups] = prometheusApi.useLazyGetGrafanaGroupsQuery();

  const createInfoOption = useCallback((): ComboboxOption<string> => {
    return {
      label: t('label-dropdown-info', "Can't find your label? Enter it manually"),
      value: '__GRAFANA_LABEL_DROPDOWN_INFO__',
      infoOption: true,
    };
  }, []);

  const toOptions = useCallback((labelsMap: Map<string, Set<string>>): Array<ComboboxOption<string>> => {
    const selectable: Array<ComboboxOption<string>> = Array.from(labelsMap.entries()).flatMap(([key, values]) =>
      Array.from(values).map<ComboboxOption<string>>((value) => ({
        label: `${key}=${value}`,
        value: `${key}=${value}`,
      }))
    );

    selectable.sort((a, b) => collator.compare(a.label ?? '', b.label ?? ''));
    return selectable;
  }, []);

  const labelOptions = useCallback(
    async (inputValue: string): Promise<Array<ComboboxOption<string>>> => {
      // Fetch grafana groups and prefer cache when available
      const response = await fetchGrafanaGroups({ limitAlerts: 0, groupLimit: 1000 }, true).unwrap();
      const labelsMap = groupsToLabels(response.data.groups);

      const selectable = toOptions(labelsMap);
      if (selectable.length === 0) {
        return [];
      }

      const options = [...selectable, createInfoOption()];
      return filterBySearch(options, inputValue, true);
    },
    [fetchGrafanaGroups, toOptions, createInfoOption]
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

function groupsToLabels(groups: Array<{ rules: Array<{ labels?: Record<string, string> }> }>) {
  const rules = groups.flatMap((group) => group.rules);

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

// Removed rulerRulesToLabels since label autocomplete only uses Prometheus namespaces for simplicity

function filterBySearch(options: Array<ComboboxOption<string>>, inputValue: string, keepInfoOption = false) {
  const search = (inputValue ?? '').toLowerCase();
  if (!search) {
    return options;
  }
  return options.filter(
    (opt) => (opt.label ?? opt.value).toLowerCase().includes(search) || (keepInfoOption && !!opt.infoOption)
  );
}
