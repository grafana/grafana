import { config } from '@grafana/runtime';
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

/**
 * The `originFiltersRenderMode` to apply when constructing ad hoc filter variables: 'controls'
 * renders dashboard-origin (pinned) filters as standalone value pickers (rendered by
 * `@grafana/scenes`) when the feature is enabled; undefined keeps the default pill rendering.
 */
export function getOriginFiltersRenderMode(): 'controls' | undefined {
  return isPinnedFiltersEnabled() ? 'controls' : undefined;
}

// Mirrors the (non-exported) isMatchAllFilter check in @grafana/scenes
export function isMatchAllFilter(filter: AdHocFilterWithLabels): boolean {
  return filter.operator === MATCH_ALL_OPERATOR && filter.value === MATCH_ALL_VALUE;
}

export function isPinnedFilter(filter: AdHocFilterWithLabels): boolean {
  return filter.origin === PINNED_FILTER_ORIGIN && !isGroupByFilter(filter);
}

/**
 * Origin filters authored in the dashboard JSON (pinned defaults or drilldown defaults) are
 * persisted separately from ephemeral runtime filters when either feature is active.
 */
export function shouldPreserveOriginFiltersOnSave(): boolean {
  return config.featureToggles.dashboardUnifiedDrilldownControls || isPinnedFiltersEnabled();
}

function stripFilterOrigin(filter: AdHocFilterWithLabels): AdHocFilterWithLabels {
  const { origin: _origin, ...rest } = filter;
  return rest;
}

/**
 * Splits persisted ad hoc filters into runtime vs dashboard-origin collections.
 * When pinned filters is off, pinned-style origin filters are flattened into runtime
 * filters so rollback does not leave dashboards in a hybrid origin-filter state.
 */
export function splitAdHocVariableFilters(allFilters: AdHocFilterWithLabels[] | undefined): {
  originFilters: AdHocFilterWithLabels[];
  filters: AdHocFilterWithLabels[];
} {
  const originFilters: AdHocFilterWithLabels[] = [];
  const filters: AdHocFilterWithLabels[] = [];

  allFilters?.forEach((filter) => {
    if (filter.origin) {
      originFilters.push(filter);
    } else {
      filters.push(filter);
    }
  });

  if (!isPinnedFiltersEnabled()) {
    const drilldownOriginFilters = originFilters.filter((f) => !isPinnedFilter(f));
    const flattenedPinned = originFilters.filter(isPinnedFilter).map(stripFilterOrigin);
    return {
      originFilters: drilldownOriginFilters,
      filters: [...filters, ...flattenedPinned],
    };
  }

  return { originFilters, filters };
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
