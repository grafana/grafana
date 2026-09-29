import { type VariableValue } from '@grafana/scenes';
import { type VariableType } from '@grafana/schema';

export const SAVED_DASHBOARD_VIEW_GROUP = 'dashboardviews.grafana.app';
export const SAVED_DASHBOARD_VIEW_VERSION = 'v0alpha1';
export const SAVED_DASHBOARD_VIEW_RESOURCE = 'saveddashboardviews';
export const SAVED_DASHBOARD_VIEW_KIND = 'SavedDashboardView';

export interface SavedViewFilter {
  key: string;
  operator: string;
  value: string;
}

export interface SavedViewVariable {
  name: string;
  type: VariableType;
  /** Ad-hoc variables carry their state in `filters`, not `value`. */
  value?: VariableValue;
  filters?: SavedViewFilter[];
}

export interface SavedViewTimeRange {
  from: string;
  to: string;
  timezone?: string;
}

/** Ad-hoc filters scoped to a tab or row rather than the whole dashboard (stretch goal, spec 2.1.1). */
export interface SavedViewSectionFilter {
  sectionKind: 'tab' | 'row';
  /** A layout path (e.g. "/tabs/1", "/rows/0/tabs/2") -- see mutation-api/commands/layoutPathResolver.ts. */
  sectionKey: string;
  variables: SavedViewVariable[];
}

/** Mirrors apps/dashboardviews/kinds/saveddashboardview.cue's spec — see the backend spec, 4.2. */
export interface SavedDashboardViewSpec {
  dashboardUID: string;
  name: string;
  description?: string;
  timeRange: SavedViewTimeRange;
  variables: SavedViewVariable[];
  sectionFilters?: SavedViewSectionFilter[];
}
