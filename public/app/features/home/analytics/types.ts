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

export interface RecommendationEnableClicked extends EventProperty {
  /** Stable id of the recommendation whose Enable CTA was clicked. */
  recommendation_id: string;
  /** Which homepage surface fired the CTA. */
  source: 'card' | 'pill';
}

export interface AlertsCardClicked extends EventProperty {
  /** Which control on the Firing alerts card was clicked. */
  action: 'alert_detail' | 'create_rule' | 'view_all_alerts' | 'view_all_rules';
  /**
   * Where the control lives on the card. For create_rule this also encodes card state:
   * 'empty_state' renders only when the card has zero alerts, 'footer' only when alerts exist.
   */
  placement: 'list' | 'empty_state' | 'footer';
  /** Canonical severity of the clicked alert (alert_detail only). */
  severity?: string;
}

export interface IncidentsCardClicked extends EventProperty {
  /** Which control on the Active incidents card was clicked. */
  action: 'incident_detail' | 'declare_incident' | 'view_all_incidents';
  /**
   * Where the control lives on the card. For declare_incident this also encodes card state:
   * 'empty_state' renders only when the card has zero incidents, 'footer' only when incidents exist.
   */
  placement: 'list' | 'empty_state' | 'footer';
  /** Canonical severity of the clicked incident (incident_detail only). */
  severity?: string;
}
