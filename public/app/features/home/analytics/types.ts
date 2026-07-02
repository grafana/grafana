import { type EventProperty } from '@grafana/runtime/unstable';

export interface TabChanged extends EventProperty {
  /** Tab the user switched to. */
  tab: string;
}

export interface ClearHistoryClicked extends EventProperty {
  /** Number of dashboards in history before clearing. */
  dashboard_count: number;
}

export interface EmptyCtaClicked extends EventProperty {
  /** Which empty-state button was clicked. */
  cta_type: 'create_dashboard' | 'browse_dashboards';
}
