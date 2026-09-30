import { dateMath, getTimeZone, type TimeRange, type TimeZone } from '@grafana/data';
import { AdHocFiltersVariable, MultiValueVariable, type SceneVariable } from '@grafana/scenes';

import { type DashboardScene } from '../scene/DashboardScene';

import { type SavedDashboardViewSpec, type SavedViewTimeRange, type SavedViewVariable } from './types';

/**
 * Reads the dashboard's current time range and dashboard-level variable values into a spec ready
 * to POST/PUT. `dashboardUID` is filled from the scene; `name` is left blank for the caller (the
 * save/rename UI) to set, since it doesn't exist yet at capture time.
 *
 * Tab/row-scoped variables (SectionFiltersSet) are out of scope here — stretch goal, spec 2.1.1.
 */
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
      filters: variable.state.filters.map(({ key, operator, value }) => ({ key, operator, value })),
    };
  }
  if (variable instanceof MultiValueVariable) {
    return {
      name: variable.state.name,
      type: variable.state.type,
      value: variable.state.value,
    };
  }
  // Other variable kinds (constant, textbox, system, ...) aren't part of the MVP capture — a view
  // is a default, not a full snapshot, so leaving them alone is a no-op, not data loss.
  return undefined;
}

/** The inverse of captureSavedViewState — pushes a stored view's spec onto a live scene. */
export function applySavedViewState(dashboard: DashboardScene, spec: SavedDashboardViewSpec): void {
  applyTimeRange(dashboard, spec.timeRange);
  applyVariables(dashboard, spec.variables);
}

/**
 * The default-aware counterpart to applySavedViewState, for the URL-driven apply path only. A
 * saved view is meant to be a default an explicit var- or from/to param in the SAME url change
 * still overrides (e.g. a shared link like "?viewFilter=view-1&from=now-15m") -- but $timeRange's and
 * every variable's own updateFromUrl already ran synchronously, in the same pass, by the time the
 * caller's deferred applySavedViewState would normally run, so a blind full apply would clobber
 * whatever they just set. `before` is a captureSavedViewState snapshot taken synchronously, BEFORE
 * those sibling handlers ran; this re-captures the CURRENT state (`after`) and, field by field
 * (time range's from/to/timezone independently, each variable by name), applies the saved spec's
 * value only where `before` and `after` are equal -- i.e. nothing explicit touched it during this
 * pass. Where they differ, the just-applied explicit value is left alone.
 */
export function applySavedViewStateAsDefault(
  dashboard: DashboardScene,
  spec: SavedDashboardViewSpec,
  before: SavedDashboardViewSpec
): void {
  const after = captureSavedViewState(dashboard);

  applyTimeRange(dashboard, mergeTimeRangeAsDefault(spec.timeRange, before.timeRange, after.timeRange));
  applyVariables(dashboard, mergeVariablesAsDefault(spec.variables, before.variables, after.variables));
}

function mergeTimeRangeAsDefault(
  spec: SavedViewTimeRange,
  before: SavedViewTimeRange,
  after: SavedViewTimeRange
): SavedViewTimeRange {
  // from/to/timezone are independent url keys (SceneTimeRange.updateFromUrl applies each on its
  // own), so a link with only ?from= leaves `to` untouched -- merging as one atomic unit would see
  // "timeRange differs" and wrongly skip the saved to as well.
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
  // A saved variable absent from BOTH before and after (deleted/renamed since the view was saved,
  // or an unsupported type captureVariable already skips) has nothing to compare, so it's treated
  // as untouched and passed through -- applyVariables' own getByName lookup already no-ops
  // harmlessly when the target doesn't exist live.
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
    // updateFilters, not a raw setState: it also publishes SceneVariableValueChangedEvent when the
    // filter expression/groupBy actually changed, which is what dependent panels/repeats/
    // interpolated content listen for. A raw setState updates the filter-chip UI (reads
    // state.filters directly) but leaves dependents silently showing data from the previous
    // filters until an unrelated refresh.
    target.updateFilters(saved.filters);
    return;
  }
  if (target instanceof MultiValueVariable && saved.value !== undefined) {
    target.changeValueTo(saved.value);
  }
}

/** True if `current` differs from `stored` in time range or any captured variable. Drives whether
 * "Overwrite" is enabled — not meant to detect changes outside what capture/apply itself covers. */
export function getSavedViewDiff(current: SavedDashboardViewSpec, stored: SavedDashboardViewSpec): boolean {
  if (timeRangeDiffers(current.timeRange, stored.timeRange)) {
    return true;
  }
  return variablesDiffer(current.variables, stored.variables);
}

function timeRangeDiffers(a: SavedViewTimeRange, b: SavedViewTimeRange): boolean {
  return a.from !== b.from || a.to !== b.to || (a.timezone ?? '') !== (b.timezone ?? '');
}

function variablesDiffer(current: SavedViewVariable[], stored: SavedViewVariable[]): boolean {
  if (current.length !== stored.length) {
    return true;
  }

  const storedByName = new Map(stored.map((v) => [v.name, v]));
  return current.some((variable) => {
    const other = storedByName.get(variable.name);
    return !other || !variableEqual(variable, other);
  });
}

// Both sides come from captureVariable's fixed field order, so a plain JSON comparison is safe here
// (no risk of the same object serializing differently on either side).
function variableEqual(a: SavedViewVariable | undefined, b: SavedViewVariable | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
