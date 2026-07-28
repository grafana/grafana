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
  surface:
    | 'alerts_card'
    | 'incidents_card'
    | 'news_card'
    | 'recent_tab'
    | 'recommendations'
    | 'existing_solution'
    | 'no_data_card';
  /** What the user asked for. Which values are valid depends on the surface (not compiler-enforced). */
  action:
    | 'alert_detail'
    | 'create_rule'
    | 'view_all_alerts'
    | 'view_all_rules'
    | 'incident_detail'
    | 'declare_incident'
    | 'view_all_incidents'
    | 'read_more_news'
    | 'create_dashboard'
    | 'browse_dashboards'
    | 'enable'
    | 'setup'
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
  /**
   * Matrix base-row id driving the current card selection (surface 'recommendations' only);
   * values are the BaseRow union in solutionsMatrix.ts.
   */
  starting_state?: string;
  /**
   * Stable id of the solution whose control was clicked (surfaces 'existing_solution' and
   * 'no_data_card'). Also valid for surface 'recommendations', where it carries the solution
   * view active when the card/pill was clicked.
   */
  solution?: string;
}
