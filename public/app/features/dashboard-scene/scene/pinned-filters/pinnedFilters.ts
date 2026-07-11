import { type SelectableValue } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type AdHocFiltersVariable, type AdHocFilterWithLabels, isGroupByFilter } from '@grafana/scenes';
import { type ComboboxOption } from '@grafana/ui';

const MATCH_ALL_OPERATOR = '=~';
const MATCH_ALL_VALUE = '.*';
export const MULTI_VALUE_OPERATOR = '=|';
export const SINGLE_VALUE_OPERATOR = '=';

export const PINNED_FILTER_ORIGIN = 'dashboard';

export function isPinnedFiltersEnabled(): boolean {
  return getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaPinnedFilters, false);
}

// Mirrors the (non-exported) isMatchAllFilter check in @grafana/scenes
export function isMatchAllFilter(filter: AdHocFilterWithLabels): boolean {
  return filter.operator === MATCH_ALL_OPERATOR && filter.value === MATCH_ALL_VALUE;
}

export function isPinnedFilter(filter: AdHocFilterWithLabels): boolean {
  return filter.origin === PINNED_FILTER_ORIGIN && !isGroupByFilter(filter);
}

export function getPinnedFilters(originFilters: AdHocFilterWithLabels[] | undefined): AdHocFilterWithLabels[] {
  return originFilters?.filter(isPinnedFilter) ?? [];
}

export function getPinnedOperator(variable: AdHocFiltersVariable): string {
  return variable.state.supportsMultiValueOperators ? MULTI_VALUE_OPERATOR : SINGLE_VALUE_OPERATOR;
}

export function createMatchAllFilter(key: string, keyLabel?: string): AdHocFilterWithLabels {
  return {
    key,
    keyLabel: keyLabel || key,
    operator: MATCH_ALL_OPERATOR,
    value: MATCH_ALL_VALUE,
    values: [MATCH_ALL_VALUE],
    valueLabels: ['All'],
    matchAllFilter: true,
    origin: PINNED_FILTER_ORIGIN,
  };
}

export function getPinnedFilterSelectedValues(filter: AdHocFilterWithLabels): Array<ComboboxOption<string>> {
  if (isMatchAllFilter(filter)) {
    return [];
  }

  const values = filter.values ?? (filter.value !== '' ? [filter.value] : []);
  const labels = filter.valueLabels ?? values;

  return values.map((value, index) => ({ value, label: labels[index] ?? value }));
}

/**
 * Commit a new set of selected values to a pinned filter. An empty selection returns the filter
 * to its unrestricted state: restoring the author's original when that original is match-all
 * (avoids flagging an unchanged filter as restorable), otherwise converting to match-all.
 */
export function commitPinnedFilterValues(
  variable: AdHocFiltersVariable,
  filter: AdHocFilterWithLabels,
  items: Array<SelectableValue<string>>
): void {
  const values = items.filter((item) => item.value != null).map((item) => item.value!);

  if (values.length === 0) {
    if (isMatchAllFilter(filter)) {
      return;
    }

    const original = variable
      .getOriginalFilters()
      .find((f) => f.key === filter.key && f.origin === PINNED_FILTER_ORIGIN);

    if (original && isMatchAllFilter(original) && filter.restorable) {
      variable.restoreOriginalFilter(filter);
    } else {
      variable.updateToMatchAll(filter);
    }
    return;
  }

  const currentValues = isMatchAllFilter(filter) ? [] : (filter.values ?? [filter.value]);
  if (values.length === currentValues.length && values.every((value, index) => value === currentValues[index])) {
    return;
  }

  const valueLabels = items.filter((item) => item.value != null).map((item) => item.label ?? item.value!);

  variable._updateFilter(filter, {
    operator: getPinnedOperator(variable),
    value: values[0],
    values,
    valueLabels,
  });
}
