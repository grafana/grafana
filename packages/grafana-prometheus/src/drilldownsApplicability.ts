import {
  AdHocVariableFilter,
  DataSourceGetDrilldownsApplicabilityOptions,
  DrilldownsApplicability,
  getDefaultTimeRange,
  TimeRange,
} from '@grafana/data';
import { t } from '@grafana/i18n';

import { PrometheusLanguageProviderInterface } from './language_provider';
import { PromQuery } from './types';

type ResourceMatcherExtractor = (queries: PromQuery[], adhocFilters: AdHocVariableFilter[]) => string | undefined;

type NormalizedDrilldownOptions = {
  filters: AdHocVariableFilter[];
  groupByKeys: string[];
  queries: PromQuery[];
  timeRange: TimeRange;
  hasScopes: boolean;
  scopes: DataSourceGetDrilldownsApplicabilityOptions<PromQuery>['scopes'];
};

type FilterPrecedence = {
  userFilterKeys: Set<string>;
  filterLastIndex: Map<string, number>;
};

const VALUE_CHECK_OPERATORS = new Set(['=', '=|']);

function normalizeOptions(
  options?: DataSourceGetDrilldownsApplicabilityOptions<PromQuery>
): NormalizedDrilldownOptions {
  return {
    filters: options?.filters ?? [],
    groupByKeys: options?.groupByKeys ?? [],
    queries: options?.queries ?? [],
    timeRange: options?.timeRange ?? getDefaultTimeRange(),
    hasScopes: (options?.scopes?.length ?? 0) > 0,
    scopes: options?.scopes,
  };
}

function getFilterCompositeKey(filter: AdHocVariableFilter): string {
  return filter.origin ? `${filter.key}|${filter.origin}` : filter.key;
}

async function fetchAvailableLabelKeys(
  languageProvider: PrometheusLanguageProviderInterface,
  options: NormalizedDrilldownOptions,
  extractResourceMatcher: ResourceMatcherExtractor
): Promise<string[]> {
  if (options.hasScopes) {
    return languageProvider.fetchSuggestions(options.timeRange, options.queries, options.scopes);
  }

  const match = extractResourceMatcher(options.queries, []);
  return languageProvider.queryLabelKeys(options.timeRange, match);
}

function getFallbackResults(options: NormalizedDrilldownOptions): DrilldownsApplicability[] {
  return [
    ...options.filters.map((filter) => ({ key: filter.key, applicable: true, origin: filter.origin })),
    ...options.groupByKeys.map((key) => ({ key, applicable: true })),
  ];
}

function buildFilterPrecedence(filters: AdHocVariableFilter[]): FilterPrecedence {
  const userFilterKeys = new Set<string>();
  const filterLastIndex = new Map<string, number>();

  filters.forEach((filter, index) => {
    if (!filter.origin) {
      userFilterKeys.add(filter.key);
    }
    filterLastIndex.set(getFilterCompositeKey(filter), index);
  });

  return { userFilterKeys, filterLastIndex };
}

function getKeysNeedingValueCheck(
  options: NormalizedDrilldownOptions,
  availableLabelKeys: Set<string>,
  precedence: FilterPrecedence
): Set<string> {
  const keys = new Set<string>();

  options.filters.forEach((filter, index) => {
    const compositeKey = getFilterCompositeKey(filter);
    const isLastWithCompositeKey = precedence.filterLastIndex.get(compositeKey) === index;
    const overriddenByUserFilter = !!filter.origin && precedence.userFilterKeys.has(filter.key);

    if (
      isLastWithCompositeKey &&
      !overriddenByUserFilter &&
      availableLabelKeys.has(filter.key) &&
      VALUE_CHECK_OPERATORS.has(filter.operator)
    ) {
      keys.add(filter.key);
    }
  });

  return keys;
}

async function fetchValuesByKey(
  languageProvider: PrometheusLanguageProviderInterface,
  options: NormalizedDrilldownOptions,
  keysNeedingValueCheck: Set<string>,
  extractResourceMatcher: ResourceMatcherExtractor
): Promise<Map<string, Set<string>>> {
  const valuesByKey = new Map<string, Set<string>>();
  const metricMatch = extractResourceMatcher(options.queries, []);

  await Promise.all(
    Array.from(keysNeedingValueCheck).map(async (key) => {
      try {
        let values: string[];
        if (options.hasScopes) {
          values = await languageProvider.fetchSuggestions(options.timeRange, options.queries, options.scopes, undefined, key);
        } else {
          values = await languageProvider.queryLabelValues(options.timeRange, key, metricMatch);
        }
        valuesByKey.set(key, new Set(values));
      } catch {
        // Skip value validation for this key on failure.
      }
    })
  );

  return valuesByKey;
}

function getFilterResult(
  filter: AdHocVariableFilter,
  isLastWithCompositeKey: boolean,
  overriddenByUserFilter: boolean,
  availableLabelKeys: Set<string>,
  valuesByKey: Map<string, Set<string>>
): DrilldownsApplicability {
  if (!isLastWithCompositeKey || overriddenByUserFilter) {
    return {
      key: filter.key,
      applicable: false,
      reason: t(
        'grafana-prometheus.datasource.drilldowns-applicability.filter-overridden',
        'Overridden by another filter with the same key'
      ),
      origin: filter.origin,
    };
  }

  if (!availableLabelKeys.has(filter.key)) {
    return {
      key: filter.key,
      applicable: false,
      reason: t(
        'grafana-prometheus.datasource.drilldowns-applicability.filter-label-not-found',
        'Label "{{label}}" not found in the queried metrics',
        { label: filter.key }
      ),
      origin: filter.origin,
    };
  }

  const availableValues = valuesByKey.get(filter.key);
  if (availableValues && VALUE_CHECK_OPERATORS.has(filter.operator)) {
    if (filter.operator === '=' && !availableValues.has(filter.value)) {
      return {
        key: filter.key,
        applicable: false,
        reason: t(
          'grafana-prometheus.datasource.drilldowns-applicability.filter-value-not-found',
          'Value "{{value}}" not found for label "{{label}}"',
          { value: filter.value, label: filter.key }
        ),
        origin: filter.origin,
      };
    }

    if (filter.operator === '=|' && filter.values) {
      const hasAnyValidValue = filter.values.some((value) => availableValues.has(value));
      if (!hasAnyValidValue) {
        return {
          key: filter.key,
          applicable: false,
          reason: t(
            'grafana-prometheus.datasource.drilldowns-applicability.filter-no-valid-values',
            'None of the selected values exist for label "{{label}}"',
            { label: filter.key }
          ),
          origin: filter.origin,
        };
      }
    }
  }

  return { key: filter.key, applicable: true, origin: filter.origin };
}

function buildFilterResults(
  options: NormalizedDrilldownOptions,
  precedence: FilterPrecedence,
  availableLabelKeys: Set<string>,
  valuesByKey: Map<string, Set<string>>
): DrilldownsApplicability[] {
  return options.filters.map((filter, index) => {
    const compositeKey = getFilterCompositeKey(filter);
    const isLastWithCompositeKey = precedence.filterLastIndex.get(compositeKey) === index;
    const overriddenByUserFilter = !!filter.origin && precedence.userFilterKeys.has(filter.key);

    return getFilterResult(filter, isLastWithCompositeKey, overriddenByUserFilter, availableLabelKeys, valuesByKey);
  });
}

function buildGroupByResults(groupByKeys: string[], availableLabelKeys: Set<string>): DrilldownsApplicability[] {
  const groupByLastIndex = new Map<string, number>();
  groupByKeys.forEach((key, index) => groupByLastIndex.set(key, index));

  return groupByKeys.map((key, index) => {
    if (groupByLastIndex.get(key) !== index) {
      return {
        key,
        applicable: false,
        reason: t(
          'grafana-prometheus.datasource.drilldowns-applicability.group-by-overridden',
          'Overridden by another group-by with the same key'
        ),
      };
    }

    if (!availableLabelKeys.has(key)) {
      return {
        key,
        applicable: false,
        reason: t(
          'grafana-prometheus.datasource.drilldowns-applicability.group-by-label-not-found',
          'Label "{{label}}" not found in the queried metrics',
          { label: key }
        ),
      };
    }

    return { key, applicable: true };
  });
}

export async function calculateApplicability(
  languageProvider: PrometheusLanguageProviderInterface,
  extractResourceMatcher: ResourceMatcherExtractor,
  rawOptions?: DataSourceGetDrilldownsApplicabilityOptions<PromQuery>
): Promise<DrilldownsApplicability[]> {
  const options = normalizeOptions(rawOptions);
  const precedence = buildFilterPrecedence(options.filters);

  let availableLabelKeys: string[];
  try {
    availableLabelKeys = await fetchAvailableLabelKeys(languageProvider, options, extractResourceMatcher);
  } catch {
    return getFallbackResults(options);
  }

  const availableLabelKeysSet = new Set(availableLabelKeys);
  const keysNeedingValueCheck = getKeysNeedingValueCheck(options, availableLabelKeysSet, precedence);
  const valuesByKey = await fetchValuesByKey(languageProvider, options, keysNeedingValueCheck, extractResourceMatcher);

  return [
    ...buildFilterResults(options, precedence, availableLabelKeysSet, valuesByKey),
    ...buildGroupByResults(options.groupByKeys, availableLabelKeysSet),
  ];
}
