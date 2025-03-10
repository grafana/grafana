import {
  Scope,
  ScopeSpecFilter,
  isEqualityOrMultiOperator,
  reverseScopeFilterOperatorMap,
  scopeFilterOperatorMap,
} from '@grafana/data';
import { AdHocFilterWithLabels, FilterOrigin } from '@grafana/scenes';

export function convertScopesToAdHocFilters(scopes: Scope[]): AdHocFilterWithLabels[] {
  const formattedFilters: Map<string, AdHocFilterWithLabels> = new Map();
  // duplicated filters that could not be processed in any way are just appended to the list
  const duplicatedFilters: AdHocFilterWithLabels[] = [];
  const allFilters = scopes.flatMap((scope) => scope.spec.filters);

  for (const filter of allFilters) {
    processFilter(formattedFilters, duplicatedFilters, filter);
  }

  return [...formattedFilters.values(), ...duplicatedFilters];
}

function processFilter(
  formattedFilters: Map<string, AdHocFilterWithLabels>,
  duplicatedFilters: AdHocFilterWithLabels[],
  filter: ScopeSpecFilter
) {
  const existingFilter = formattedFilters.get(filter.key);

  if (existingFilter && canValueBeMerged(existingFilter.operator, filter.operator)) {
    mergeFilterValues(existingFilter, filter);
  } else if (!existingFilter) {
    // Add filter to map either only if it is new.
    // Otherwise it is an existing filter that cannot be converted to multi-value
    // and thus will be moved to the duplicatedFilters list
    formattedFilters.set(filter.key, {
      key: filter.key,
      operator: reverseScopeFilterOperatorMap[filter.operator],
      value: filter.value,
      values: filter.values ?? [filter.value],
      origin: FilterOrigin.Scopes,
    });
  } else {
    duplicatedFilters.push({
      key: filter.key,
      operator: reverseScopeFilterOperatorMap[filter.operator],
      value: filter.value,
      values: filter.values ?? [filter.value],
      origin: FilterOrigin.Scopes,
    });
  }
}

function mergeFilterValues(adHocFilter: AdHocFilterWithLabels, filter: ScopeSpecFilter) {
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

function canValueBeMerged(adHocFilterOperator: string, filterOperator: string) {
  const scopeConvertedOperator = scopeFilterOperatorMap[adHocFilterOperator];

  if (!isEqualityOrMultiOperator(scopeConvertedOperator) || !isEqualityOrMultiOperator(filterOperator)) {
    return false;
  }

  if (
    (scopeConvertedOperator.includes('not') && !filterOperator.includes('not')) ||
    (!scopeConvertedOperator.includes('not') && filterOperator.includes('not'))
  ) {
    return false;
  }

  return true;
}
