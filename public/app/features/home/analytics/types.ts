import { type EventProperty } from '@grafana/runtime/unstable';

export interface TabChanged extends EventProperty {
  /** Tab the user switched to. */
  tab: string;
}

export interface ClearHistoryClicked extends EventProperty {
  /** Number of dashboards in history before clearing. */
  dashboard_count: number;
}

export interface CtaClicked extends EventProperty {
  /** Which homepage widget fired the CTA. */
  surface: 'alerts_card' | 'incidents_card' | 'recent_tab' | 'recommendations' | 'existing_solution' | 'no_data_card';
  /** What the user asked for. Which values are valid depends on the surface (not compiler-enforced). */
  action:
    | 'alert_detail'
    | 'create_rule'
    | 'view_all_alerts'
    | 'view_all_rules'
    | 'incident_detail'
    | 'declare_incident'
    | 'view_all_incidents'
    | 'create_dashboard'
    | 'browse_dashboards'
    | 'enable'
    | 'open_solution'
    | 'view_alerts'
    | 'switch_solution'
    | 'connect_data_source';
  /**
   * Where on the widget the control lives. 'list' | 'empty_state' | 'footer' apply to the
   * alerts/incidents cards and the recent tab; 'card' | 'pill' apply to recommendations and
   * the no-data card; the existing-solution card uses 'card'.
   */
  placement: 'list' | 'empty_state' | 'footer' | 'card' | 'pill';
  /** Stable id of the recommendation whose Enable CTA was clicked (surface 'recommendations' only). */
  recommendation_id?: string;
  /** Stable id of the solution whose control was clicked (surfaces 'existing_solution' and 'no_data_card' only). */
  solution?: string;
  /** Canonical severity of the clicked alert (surface 'alerts_card', action 'alert_detail' only). */
  severity?: string;
  /** Milliseconds between the card's data becoming visible and this click. Absent if the card never finished loading (surface 'alerts_card' only). */
  ms_since_load?: number;
  /** True when the click opens a new tab/window (Cmd/Ctrl-click) instead of SPA-navigating this tab. */
  new_tab?: boolean;
}
