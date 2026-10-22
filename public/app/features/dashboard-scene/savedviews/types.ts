import { type VariableValue } from '@grafana/scenes';
import { type VariableType } from '@grafana/schema';

interface SavedViewFilter {
  key: string;
  operator: string;
  value: string;
  /** The selection for multi-value operators. */
  values?: string[];
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

/** Ad hoc filters scoped to a tab or row. */
export interface SavedViewSectionFilter {
  sectionKind: 'tab' | 'row';
  /** A layout path, e.g. "/tabs/1" or "/rows/0/tabs/2". */
  sectionKey: string;
  /** Title at capture time, so apply can tell if layout edits moved sectionKey to another section. */
  sectionTitle?: string;
  variables: SavedViewVariable[];
}

/** Mirrors the spec in apps/dashboardviews/kinds/saveddashboardview.cue. */
export interface SavedDashboardViewSpec {
  dashboardUID: string;
  name: string;
  timeRange: SavedViewTimeRange;
  variables: SavedViewVariable[];
  sectionFilters?: SavedViewSectionFilter[];
}
