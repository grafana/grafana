import { type EventProperty } from '@grafana/runtime/unstable';

export interface TabChanged extends EventProperty {
  /** Tab the user switched to. */
  tab: string;
}

export interface ClearHistoryClicked extends EventProperty {
  /** Number of dashboards in history before clearing. */
  dashboard_count: number;
}

interface CtaClickedBase extends EventProperty {
  /** Which homepage widget fired the CTA. */
  surface: string;
  /** What the user asked for. */
  action: string;
  /** Where on the widget the control lives. */
  placement: string;
  /** Stable id of the solution whose control was clicked. */
  solution?: string;
}

type Satisfies<Constraint, Target extends Constraint> = Target;

export type CtaClicked = Satisfies<
  CtaClickedBase,
  | {
      surface: 'alerts_card';
      action: 'alert_detail' | 'create_rule' | 'view_all_alerts' | 'view_all_rules';
      placement: 'list' | 'empty_state' | 'footer';
    }
  | {
      surface: 'incidents_card';
      action: 'incident_detail' | 'declare_incident' | 'view_all_incidents';
      placement: 'list' | 'empty_state' | 'footer';
    }
  | {
      surface: 'news_card';
      action: 'read_more_news';
      placement: 'footer';
    }
  | {
      surface: 'recent_tab';
      action: 'create_dashboard' | 'browse_dashboards';
      placement: 'empty_state';
    }
  | {
      surface: 'recommendations';
      action: 'enable' | 'setup';
      placement: 'card' | 'pill';
      /** Stable id of the recommendation whose Enable CTA was clicked. */
      recommendation_id: string;
      /**
       * Matrix base-row id driving the current card selection;
       * values are the BaseRow union in solutionsMatrix.ts.
       */
      starting_state: string;
      solution?: string;
    }
  | {
      surface: 'existing_solution';
      action: 'switch_solution' | 'view_alerts' | 'open_solution';
      placement: 'card';
      solution: string;
    }
  | {
      surface: 'no_data_card';
      action: 'open_solution' | 'connect_data_source';
      placement: 'pill' | 'card';
      solution?: string;
    }
  | {
      surface: 'overview';
      action: 'change_overview_filter' | 'open_guide';
      placement: 'menu' | 'card';
      solution: string;
    }
>;
