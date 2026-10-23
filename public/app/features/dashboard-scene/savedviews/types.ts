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

/** Mirrors the spec in apps/dashboardviews/kinds/saveddashboardview.cue. */
export interface SavedDashboardViewSpec {
  dashboardUID: string;
  name: string;
  timeRange: SavedViewTimeRange;
  variables: SavedViewVariable[];
}
