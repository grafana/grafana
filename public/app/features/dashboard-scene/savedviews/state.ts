import { dateMath, getTimeZone, type TimeRange, type TimeZone } from '@grafana/data';
import { AdHocFiltersVariable, MultiValueVariable, type SceneVariable, type SceneVariables } from '@grafana/scenes';

import { resolveLayoutPath } from '../mutation-api/commands/layoutPathResolver';
import { type DashboardScene } from '../scene/DashboardScene';
import { type RowItem } from '../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../scene/layout-rows/RowsLayoutManager';
import { type TabItem } from '../scene/layout-tabs/TabItem';
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
  sectionTitle: string | undefined;
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
        scopes.push({ sectionKind: 'row', sectionKey: path, sectionTitle: row.state.title, variables });
      }
      scopes.push(...collectSectionVariableScopes(row.state.layout, path));
    });
  } else if (layout instanceof TabsLayoutManager) {
    layout.state.tabs.forEach((tab, i) => {
      const path = pathSoFar === '/' ? `/tabs/${i}` : `${pathSoFar}/tabs/${i}`;
      const variables = tab.state.$variables?.state.variables;
      if (variables && variables.length > 0) {
        scopes.push({ sectionKind: 'tab', sectionKey: path, sectionTitle: tab.state.title, variables });
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
    .map(({ sectionKind, sectionKey, sectionTitle, variables }) => ({
      sectionKind,
      sectionKey,
      ...(sectionTitle ? { sectionTitle } : {}),
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

/**
 * The default-aware counterpart to applySavedViewState, for the URL-driven apply path only. A
 * saved view is meant to be a default an explicit var- or from/to param in the SAME url change
 * still overrides (e.g. a shared link like "?viewFilter=view-1&from=now-15m") -- but $timeRange's and
 * every variable's own updateFromUrl already ran synchronously, in the same pass, by the time the
 * caller's deferred applySavedViewState would normally run, so a blind full apply would clobber
 * whatever they just set. `before` is a captureSavedViewState snapshot taken synchronously, BEFORE
 * those sibling handlers ran; this re-captures the CURRENT state (`after`) and, field by field
 * (time range's from/to/timezone independently, each variable by name, each section's variables by
 * name within that section), applies the saved spec's value only where `before` and `after` are
 * equal -- i.e. nothing explicit touched it during this pass. Where they differ, the just-applied
 * explicit value is left alone.
 */
export function applySavedViewStateAsDefault(
  dashboard: DashboardScene,
  spec: SavedDashboardViewSpec,
  before: SavedDashboardViewSpec
): void {
  const after = captureSavedViewState(dashboard);

  applyTimeRange(dashboard, mergeTimeRangeAsDefault(spec.timeRange, before.timeRange, after.timeRange));
  if (dashboard.state.$variables) {
    applyVariablesToSet(
      dashboard.state.$variables,
      mergeVariablesAsDefault(spec.variables, before.variables, after.variables)
    );
  }
  applySectionFilters(
    dashboard,
    mergeSectionFiltersAsDefault(spec.sectionFilters, before.sectionFilters, after.sectionFilters)
  );
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
  // as untouched and passed through -- applyVariablesToSet's own getByName lookup already no-ops
  // harmlessly when the target doesn't exist live.
  return spec.filter((saved) => variableEqual(beforeByName.get(saved.name), afterByName.get(saved.name)));
}

function mergeSectionFiltersAsDefault(
  spec: SavedViewSectionFilter[] | undefined,
  before: SavedViewSectionFilter[] | undefined,
  after: SavedViewSectionFilter[] | undefined
): SavedViewSectionFilter[] | undefined {
  if (!spec) {
    return undefined;
  }
  const beforeByKey = new Map((before ?? []).map((s) => [s.sectionKey, s]));
  const afterByKey = new Map((after ?? []).map((s) => [s.sectionKey, s]));

  // Only ever iterates spec's own sections, never before/after's -- a section present live but
  // absent from spec is never touched, matching applySectionFilters' own "absence in spec ⇒ no
  // effect" behavior.
  const merged = spec
    .map((section) => {
      const variables = mergeVariablesAsDefault(
        section.variables,
        beforeByKey.get(section.sectionKey)?.variables ?? [],
        afterByKey.get(section.sectionKey)?.variables ?? []
      );
      return variables.length > 0 ? { ...section, variables } : undefined;
    })
    .filter((s): s is SavedViewSectionFilter => s !== undefined);

  return merged.length > 0 ? merged : undefined;
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

/**
 * Applies each saved section's filters to the live section at the same layout path. A path that no
 * longer resolves (the dashboard's tabs/rows changed since the view was saved) or a section with no
 * variable set of its own is skipped, not an error — same "unknown target is a no-op" philosophy as
 * applyVariablesToSet.
 *
 * sectionKey is a structural index path (e.g. "/tabs/0"): reordering, inserting, or deleting
 * tabs/rows can leave it resolving successfully but to a DIFFERENT section than the one captured.
 * sectionTitle is a lightweight identity check against exactly that — if the resolved section's
 * title doesn't match what was captured, this is treated the same as a failed resolution (skipped,
 * not applied to the wrong section). Older saved views without a captured sectionTitle (title
 * undefined) skip the check entirely, applying unconditionally as before -- no forced re-save.
 */
function applySectionFilters(dashboard: DashboardScene, sectionFilters: SavedViewSectionFilter[] | undefined): void {
  if (!sectionFilters) {
    return;
  }

  for (const section of sectionFilters) {
    let item: RowItem | TabItem | undefined;
    try {
      item = resolveLayoutPath(dashboard.state.body, section.sectionKey).item;
    } catch {
      continue;
    }
    if (section.sectionTitle !== undefined && item?.state.title !== section.sectionTitle) {
      continue;
    }
    if (item?.state.$variables) {
      applyVariablesToSet(item.state.$variables, section.variables);
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
function variableEqual(a: SavedViewVariable | undefined, b: SavedViewVariable | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
