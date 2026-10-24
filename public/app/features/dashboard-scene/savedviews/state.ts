import { dateMath, getTimeZone, type TimeRange, type TimeZone } from '@grafana/data';
import { AdHocFiltersVariable, MultiValueVariable, type SceneVariable } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SavedDashboardViewSpec, type SavedViewTimeRange, type SavedViewVariable } from './types';

/** Captures the time range and dashboard-level variables. `name` is left for the caller to set. */
export function captureSavedViewState(dashboard: DashboardScene): SavedDashboardViewSpec {
  return {
    dashboardUID: dashboard.state.uid ?? '',
    name: '',
    timeRange: captureTimeRange(dashboard),
    variables: captureVariables(dashboard),
  };
}

function captureTimeRange(dashboard: DashboardScene): SavedViewTimeRange {
  const $timeRange = dashboard.state.$timeRange;
  const timezone = $timeRange?.state.timeZone;

  return {
    from: $timeRange?.state.from ?? 'now-6h',
    to: $timeRange?.state.to ?? 'now',
    ...(timezone ? { timezone } : {}),
  };
}

function captureVariables(dashboard: DashboardScene): SavedViewVariable[] {
  const variables = dashboard.state.$variables?.state.variables ?? [];
  return variables.map(captureVariable).filter((v): v is SavedViewVariable => v !== undefined);
}

function captureVariable(variable: SceneVariable): SavedViewVariable | undefined {
  if (variable instanceof AdHocFiltersVariable) {
    return {
      name: variable.state.name,
      type: variable.state.type,
      filters: variable.state.filters.map(({ key, operator, value, values }) => ({
        key,
        operator,
        value,
        ...(values ? { values } : {}),
      })),
    };
  }
  if (variable instanceof MultiValueVariable) {
    return {
      name: variable.state.name,
      type: variable.state.type,
      value: variable.state.value,
    };
  }
  // Other kinds (constant, textbox, ...) aren't captured.
  return undefined;
}

/**
 * Applies a stored spec to the scene. Variables the view omits reset to `baseline` when given.
 */
export function applySavedViewState(
  dashboard: DashboardScene,
  spec: SavedDashboardViewSpec,
  baseline?: SavedDashboardViewSpec
): void {
  applyTimeRange(dashboard, spec.timeRange);
  applyVariables(dashboard, mergeVariablesWithBaseline(spec.variables, baseline?.variables));
}

function mergeVariablesWithBaseline(
  spec: SavedViewVariable[],
  baseline: SavedViewVariable[] | undefined
): SavedViewVariable[] {
  if (!baseline) {
    return spec;
  }
  const byName = new Map(baseline.map((v) => [v.name, v]));
  for (const variable of spec) {
    byName.set(variable.name, variable);
  }
  return Array.from(byName.values());
}

/**
 * applySavedViewState for the URL path, where explicit var- or from/to params in the same URL
 * change win. Fields that changed between `before` and now were set by those params and are kept.
 */
export function applySavedViewStateAsDefault(
  dashboard: DashboardScene,
  spec: SavedDashboardViewSpec,
  before: SavedDashboardViewSpec,
  baseline?: SavedDashboardViewSpec
): void {
  const after = captureSavedViewState(dashboard);
  const variables = mergeVariablesWithBaseline(spec.variables, baseline?.variables);

  applyTimeRange(dashboard, mergeTimeRangeAsDefault(spec.timeRange, before.timeRange, after.timeRange));
  applyVariables(dashboard, mergeVariablesAsDefault(variables, before.variables, after.variables));
}

function mergeTimeRangeAsDefault(
  spec: SavedViewTimeRange,
  before: SavedViewTimeRange,
  after: SavedViewTimeRange
): SavedViewTimeRange {
  // from/to/timezone are separate URL keys, so merge them independently.
  const timezone = (before.timezone ?? '') === (after.timezone ?? '') ? spec.timezone : after.timezone;
  return {
    from: before.from === after.from ? spec.from : after.from,
    to: before.to === after.to ? spec.to : after.to,
    ...(timezone ? { timezone } : {}),
  };
}

function mergeVariablesAsDefault(
  spec: SavedViewVariable[],
  before: SavedViewVariable[],
  after: SavedViewVariable[]
): SavedViewVariable[] {
  const beforeByName = new Map(before.map((v) => [v.name, v]));
  const afterByName = new Map(after.map((v) => [v.name, v]));
  // Variables missing from the live dashboard pass through; applyVariables skips them.
  return spec.filter((saved) => variableEqual(beforeByName.get(saved.name), afterByName.get(saved.name)));
}

function applyTimeRange(dashboard: DashboardScene, timeRange: SavedViewTimeRange): void {
  const $timeRange = dashboard.state.$timeRange;
  if (!$timeRange) {
    return;
  }

  const range = toTimeRange(timeRange.from, timeRange.to, timeRange.timezone);
  if (range) {
    $timeRange.onTimeRangeChange(range);
  }
  if (timeRange.timezone) {
    $timeRange.onTimeZoneChange(timeRange.timezone);
  }
}

function toTimeRange(from: string, to: string, timezone?: TimeZone): TimeRange | undefined {
  const resolvedTimeZone = getTimeZone({ timeZone: timezone });
  const fromDt = dateMath.toDateTime(from, { roundUp: false, timezone: resolvedTimeZone });
  const toDt = dateMath.toDateTime(to, { roundUp: true, timezone: resolvedTimeZone });
  if (!fromDt || !toDt) {
    return undefined;
  }
  return { from: fromDt, to: toDt, raw: { from, to } };
}

function applyVariables(dashboard: DashboardScene, variables: SavedViewVariable[]): void {
  const variableSet = dashboard.state.$variables;
  if (!variableSet) {
    return;
  }

  for (const saved of variables) {
    const target = variableSet.getByName(saved.name);
    if (target) {
      applyVariable(target, saved);
    }
  }
}

function applyVariable(target: SceneVariable, saved: SavedViewVariable): void {
  if (target instanceof AdHocFiltersVariable && saved.filters) {
    // updateFilters, not setState, so SceneVariableValueChangedEvent reaches dependent panels.
    target.updateFilters(saved.filters);
    return;
  }
  if (target instanceof MultiValueVariable && saved.value !== undefined) {
    target.changeValueTo(saved.value);
  }
}

/**
 * Whether applying `stored` would change the dashboard, using applySavedViewState's rules:
 * omitted variables reset to `baseline`, a missing timezone is left alone.
 */
export function getSavedViewDiff(
  current: SavedDashboardViewSpec,
  stored: SavedDashboardViewSpec,
  baseline?: SavedDashboardViewSpec
): boolean {
  if (timeRangeDiffers(current.timeRange, stored.timeRange)) {
    return true;
  }
  return variablesDiffer(current.variables, mergeVariablesWithBaseline(stored.variables, baseline?.variables));
}

function timeRangeDiffers(current: SavedViewTimeRange, stored: SavedViewTimeRange): boolean {
  if (current.from !== stored.from || current.to !== stored.to) {
    return true;
  }
  return stored.timezone !== undefined && (current.timezone ?? '') !== stored.timezone;
}

function variablesDiffer(current: SavedViewVariable[], expected: SavedViewVariable[]): boolean {
  const currentByName = new Map(current.map((v) => [v.name, v]));
  return expected.some((variable) => {
    const live = currentByName.get(variable.name);
    return live !== undefined && !variableEqual(live, variable);
  });
}

// Compares selections, not objects: server copies can differ in key order and "a" vs ["a"].
function variableEqual(a: SavedViewVariable | undefined, b: SavedViewVariable | undefined): boolean {
  if (!a || !b) {
    return a === b;
  }
  if (a.filters || b.filters) {
    return JSON.stringify(normalizeFilters(a.filters)) === JSON.stringify(normalizeFilters(b.filters));
  }
  return JSON.stringify(normalizeValue(a.value)) === JSON.stringify(normalizeValue(b.value));
}

function normalizeFilters(filters: SavedViewVariable['filters']) {
  return (filters ?? []).map(({ key, operator, value, values }) => ({ key, operator, value, values: values ?? [] }));
}

function normalizeValue(value: SavedViewVariable['value']): unknown[] {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
