import {
  Scope,
  ScopeSpecFilter,
  isScopeFilterSingleOrMultiOperator,
  reverseScopeFilterOperatorMap,
  scopeFilterOperatorMap,
} from '@grafana/data/src/types/scopes';
import { AdHocFilterWithLabels } from '@grafana/scenes';
import { FilterSource } from '@grafana/scenes/src/variables/adhoc/AdHocFiltersVariable';

export function convertScopesToAdHocFilters(scopes: Scope[]): AdHocFilterWithLabels[] {
  const formattedFilters: Map<string, AdHocFilterWithLabels> = new Map();
  const allFilters = scopes.flatMap((scope) => scope.spec.filters);

  for (const filter of allFilters) {
    processFilter(formattedFilters, filter);
  }

  return [...formattedFilters.values()];
}

function processFilter(formattedFilters: Map<string, AdHocFilterWithLabels>, filter: ScopeSpecFilter) {
  const existingFilter = formattedFilters.get(filter.key);

  if (existingFilter && isScopeFilterSingleOrMultiOperator(filter.operator)) {
    mergeFilterValues(existingFilter, filter);
  } else if (!existingFilter) {
    // Add filter to map either only if it is new.
    // Otherwise it is an existing filter that cannot be converted to multi-value
    // and thus will be ignored
    formattedFilters.set(filter.key, {
      key: filter.key,
      operator: reverseScopeFilterOperatorMap[filter.operator],
      value: filter.value,
      values: filter.values ?? [filter.value],
      source: FilterSource.Scopes,
    });
  }
}

function mergeFilterValues(adHocFilter: AdHocFilterWithLabels, filter: ScopeSpecFilter) {
  // If the existing filter does NOT support multi-values, ignore the filter
  // The rest of the filters with the same key will be lost
  if (!isScopeFilterSingleOrMultiOperator(scopeFilterOperatorMap[adHocFilter.operator])) {
    return;
  }

  const values = filter.values ?? [filter.value];

  for (const value of values) {
    if (!adHocFilter.values?.includes(value)) {
      adHocFilter.values?.push(value);
    }
  }

  // If there's only one value, there's no need to update the
  // operator to its multi-value equivalent
  if (adHocFilter.values?.length === 1) {
    return;
  }

  // Otherwise update it to the equivalent multi-value operator
  if (filter.operator === 'equals' && adHocFilter.operator === reverseScopeFilterOperatorMap['equals']) {
    adHocFilter.operator = reverseScopeFilterOperatorMap['one-of'];
  } else if (filter.operator === 'not-equals' && adHocFilter.operator === reverseScopeFilterOperatorMap['not-equals']) {
    adHocFilter.operator = reverseScopeFilterOperatorMap['not-one-of'];
  }
}
