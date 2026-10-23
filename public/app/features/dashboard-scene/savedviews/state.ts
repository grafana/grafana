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
 * Captures the time range and variables, including tab/row-scoped ad hoc filters when enabled.
 * `name` is left for the caller to set.
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

interface SectionVariableScope {
  sectionKind: 'tab' | 'row';
  sectionKey: string;
  sectionTitle: string | undefined;
  variables: SceneVariable[];
}

/**
 * Collects each tab/row's own ad hoc variable set, keyed by layout path (e.g. "/rows/0/tabs/2"),
 * the same paths layoutPathResolver.ts resolves on apply.
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
 * Tab/row-scoped ad hoc filters. No toggle check needed: sections only get their own `$variables`
 * through toggle-gated UI.
 */
function captureSectionFilters(dashboard: DashboardScene): SavedViewSectionFilter[] | undefined {
  const sectionFilters = collectSectionVariableScopes(dashboard.state.body, '/')
    .map(({ sectionKind, sectionKey, sectionTitle, variables }) => ({
      sectionKind,
      sectionKey,
      ...(sectionTitle !== undefined ? { sectionTitle } : {}),
      variables: captureVariables(variables),
    }))
    .filter((section) => section.variables.length > 0);

  return sectionFilters.length > 0 ? sectionFilters : undefined;
}

/**
 * Applies a stored spec to the scene. Variables and section filters it omits reset to `baseline`
 * when given.
 */
export function applySavedViewState(
  dashboard: DashboardScene,
  spec: SavedDashboardViewSpec,
  baseline?: SavedDashboardViewSpec
): void {
  applyTimeRange(dashboard, spec.timeRange);
  if (dashboard.state.$variables) {
    applyVariablesToSet(dashboard.state.$variables, mergeVariablesWithBaseline(spec.variables, baseline?.variables));
  }
  applySectionFilters(dashboard, mergeSectionFiltersWithBaseline(spec.sectionFilters, baseline?.sectionFilters));
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

function mergeSectionFiltersWithBaseline(
  spec: SavedViewSectionFilter[] | undefined,
  baseline: SavedViewSectionFilter[] | undefined
): SavedViewSectionFilter[] | undefined {
  if (!baseline) {
    return spec;
  }
  const bySectionKey = new Map(baseline.map((s) => [s.sectionKey, s]));
  for (const section of spec ?? []) {
    const existing = bySectionKey.get(section.sectionKey);
    bySectionKey.set(section.sectionKey, {
      ...section,
      variables: mergeVariablesWithBaseline(section.variables, existing?.variables),
    });
  }
  const merged = Array.from(bySectionKey.values());
  return merged.length > 0 ? merged : undefined;
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
  if (dashboard.state.$variables) {
    applyVariablesToSet(
      dashboard.state.$variables,
      mergeVariablesAsDefault(variables, before.variables, after.variables)
    );
  }
  applySectionFilters(
    dashboard,
    mergeSectionFiltersAsDefault(
      mergeSectionFiltersWithBaseline(spec.sectionFilters, baseline?.sectionFilters),
      before.sectionFilters,
      after.sectionFilters
    )
  );
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
  // Variables missing from the live dashboard pass through; applyVariablesToSet skips them.
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

  // Sections absent from spec are left alone, matching applySectionFilters.
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
    // updateFilters, not setState, so SceneVariableValueChangedEvent reaches dependent panels.
    target.updateFilters(saved.filters);
    return;
  }
  if (target instanceof MultiValueVariable && saved.value !== undefined) {
    target.changeValueTo(saved.value);
  }
}

/**
 * Applies saved section filters by layout path. Sections that no longer resolve, or whose title no
 * longer matches after layout edits, are skipped. Views without a sectionTitle skip that check.
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

/**
 * Whether applying `stored` would change the dashboard, using applySavedViewState's rules:
 * omitted variables and section filters reset to `baseline`, a missing timezone is left alone.
 */
export function getSavedViewDiff(
  current: SavedDashboardViewSpec,
  stored: SavedDashboardViewSpec,
  baseline?: SavedDashboardViewSpec
): boolean {
  if (timeRangeDiffers(current.timeRange, stored.timeRange)) {
    return true;
  }
  if (variablesDiffer(current.variables, mergeVariablesWithBaseline(stored.variables, baseline?.variables))) {
    return true;
  }
  return sectionFiltersDiffer(
    current.sectionFilters,
    mergeSectionFiltersWithBaseline(stored.sectionFilters, baseline?.sectionFilters)
  );
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

function sectionFiltersDiffer(
  current: SavedViewSectionFilter[] | undefined,
  expected: SavedViewSectionFilter[] | undefined
): boolean {
  const currentByKey = new Map((current ?? []).map((s) => [s.sectionKey, s]));
  return (expected ?? []).some((section) => {
    const live = currentByKey.get(section.sectionKey);
    if (!live || (section.sectionTitle !== undefined && live.sectionTitle !== section.sectionTitle)) {
      // Apply skips this section too, so it can't make the view dirty.
      return false;
    }
    return variablesDiffer(live.variables, section.variables);
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
