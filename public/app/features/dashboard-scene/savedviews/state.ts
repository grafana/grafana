import { dateMath, getTimeZone, type TimeRange, type TimeZone } from '@grafana/data';
import { AdHocFiltersVariable, MultiValueVariable, type SceneVariable, type SceneVariables } from '@grafana/scenes';

import { resolveLayoutPath } from '../mutation-api/commands/layoutPathResolver';
import { type DashboardScene } from '../scene/DashboardScene';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { TabsLayoutManager } from '../scene/layout-tabs/TabsLayoutManager';
import { type DashboardLayoutManager } from '../scene/types/DashboardLayoutManager';

import {
  type SavedDashboardViewSpec,
  type SavedViewSectionFilter,
  type SavedViewTimeRange,
  type SavedViewVariable,
} from './types';

/**
 * Reads the dashboard's current time range and variable values (dashboard-level, plus tab/row-scoped
 * ad-hoc filters when the feature is on) into a spec ready to POST/PUT. `dashboardUID` is filled from
 * the scene; `name` is left blank for the caller (the save/rename UI) to set, since it doesn't exist
 * yet at capture time.
 */
export function captureSavedViewState(dashboard: DashboardScene): SavedDashboardViewSpec {
  const sectionFilters = captureSectionFilters(dashboard);
  return {
    dashboardUID: dashboard.state.uid ?? '',
    name: '',
    timeRange: captureTimeRange(dashboard),
    variables: captureVariables(dashboard.state.$variables?.state.variables ?? []),
    ...(sectionFilters ? { sectionFilters } : {}),
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

function captureVariables(variables: SceneVariable[]): SavedViewVariable[] {
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

interface SectionVariableScope {
  sectionKind: 'tab' | 'row';
  sectionKey: string;
  variables: SceneVariable[];
}

/**
 * Walks the dashboard's layout tree (tabs/rows, arbitrarily nested) collecting each section's own
 * ad-hoc variable set, keyed by its layout path (e.g. "/tabs/1", "/rows/0/tabs/2" — see
 * mutation-api/commands/layoutPathResolver.ts, which resolves the same paths back to a section on apply).
 * Mirrors the traversal in mutation-api/commands/variableScope.ts's findSectionPathsContainingVariable.
 */
function collectSectionVariableScopes(layout: DashboardLayoutManager, pathSoFar: string): SectionVariableScope[] {
  const scopes: SectionVariableScope[] = [];

  if (layout instanceof RowsLayoutManager) {
    layout.state.rows.forEach((row, i) => {
      const path = pathSoFar === '/' ? `/rows/${i}` : `${pathSoFar}/rows/${i}`;
      const variables = row.state.$variables?.state.variables;
      if (variables && variables.length > 0) {
        scopes.push({ sectionKind: 'row', sectionKey: path, variables });
      }
      scopes.push(...collectSectionVariableScopes(row.state.layout, path));
    });
  } else if (layout instanceof TabsLayoutManager) {
    layout.state.tabs.forEach((tab, i) => {
      const path = pathSoFar === '/' ? `/tabs/${i}` : `${pathSoFar}/tabs/${i}`;
      const variables = tab.state.$variables?.state.variables;
      if (variables && variables.length > 0) {
        scopes.push({ sectionKind: 'tab', sectionKey: path, variables });
      }
      scopes.push(...collectSectionVariableScopes(tab.state.layout, path));
    });
  }

  return scopes;
}

/**
 * Tab/row-scoped ad-hoc filters (stretch goal, spec 2.1.1). No explicit feature-toggle check here:
 * a section only has a `$variables` set of its own once `dashboardUnifiedDrilldownControls`-gated UI
 * has actually added one (TabItem.tsx/RowItem.tsx), so a dashboard that never used the feature walks
 * to an empty list here regardless — the same effective gate without a direct config.featureToggles
 * read in this non-component module.
 */
function captureSectionFilters(dashboard: DashboardScene): SavedViewSectionFilter[] | undefined {
  const sectionFilters = collectSectionVariableScopes(dashboard.state.body, '/')
    .map(({ sectionKind, sectionKey, variables }) => ({
      sectionKind,
      sectionKey,
      variables: captureVariables(variables),
    }))
    .filter((section) => section.variables.length > 0);

  return sectionFilters.length > 0 ? sectionFilters : undefined;
}

/** The inverse of captureSavedViewState — pushes a stored view's spec onto a live scene. */
export function applySavedViewState(dashboard: DashboardScene, spec: SavedDashboardViewSpec): void {
  applyTimeRange(dashboard, spec.timeRange);
  if (dashboard.state.$variables) {
    applyVariablesToSet(dashboard.state.$variables, spec.variables);
  }
  applySectionFilters(dashboard, spec.sectionFilters);
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

function applyVariablesToSet(variableSet: SceneVariables, variables: SavedViewVariable[]): void {
  for (const saved of variables) {
    const target = variableSet.getByName(saved.name);
    if (target) {
      applyVariable(target, saved);
    }
  }
}

function applyVariable(target: SceneVariable, saved: SavedViewVariable): void {
  if (target instanceof AdHocFiltersVariable && saved.filters) {
    target.setState({ filters: saved.filters });
    return;
  }
  if (target instanceof MultiValueVariable && saved.value !== undefined) {
    target.changeValueTo(saved.value);
  }
}

/**
 * Applies each saved section's filters to the live section at the same layout path. A path that no
 * longer resolves (the dashboard's tabs/rows changed since the view was saved) or a section with no
 * variable set of its own is skipped, not an error — same "unknown target is a no-op" philosophy as
 * applyVariablesToSet.
 */
function applySectionFilters(dashboard: DashboardScene, sectionFilters: SavedViewSectionFilter[] | undefined): void {
  if (!sectionFilters) {
    return;
  }

  for (const section of sectionFilters) {
    let variableSet: SceneVariables | undefined;
    try {
      variableSet = resolveLayoutPath(dashboard.state.body, section.sectionKey).item?.state.$variables;
    } catch {
      continue;
    }
    if (variableSet) {
      applyVariablesToSet(variableSet, section.variables);
    }
  }
}

/** True if `current` differs from `stored` in time range or any captured variable (dashboard-level or
 * section-scoped). Drives whether "Overwrite" is enabled — not meant to detect changes outside what
 * capture/apply itself covers. */
export function getSavedViewDiff(current: SavedDashboardViewSpec, stored: SavedDashboardViewSpec): boolean {
  if (timeRangeDiffers(current.timeRange, stored.timeRange)) {
    return true;
  }
  if (variablesDiffer(current.variables, stored.variables)) {
    return true;
  }
  return sectionFiltersDiffer(current.sectionFilters, stored.sectionFilters);
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

function sectionFiltersDiffer(
  current: SavedViewSectionFilter[] | undefined,
  stored: SavedViewSectionFilter[] | undefined
): boolean {
  const currentSections = current ?? [];
  const storedSections = stored ?? [];
  if (currentSections.length !== storedSections.length) {
    return true;
  }

  const storedByKey = new Map(storedSections.map((s) => [s.sectionKey, s]));
  return currentSections.some((section) => {
    const other = storedByKey.get(section.sectionKey);
    return !other || section.sectionKind !== other.sectionKind || variablesDiffer(section.variables, other.variables);
  });
}

// Both sides come from captureVariable's fixed field order, so a plain JSON comparison is safe here
// (no risk of the same object serializing differently on either side).
function variableEqual(a: SavedViewVariable, b: SavedViewVariable): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
