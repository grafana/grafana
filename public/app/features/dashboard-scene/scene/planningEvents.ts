import { BusEventWithPayload } from '@grafana/data';

import { type DashboardPlan } from './dashboardPlan';

export class DashboardPlanningEvent extends BusEventWithPayload<{
  planId: string;
  action: 'build' | 'dismiss' | 'closed';
  /** The plan as the preview left it, with plan editing on. */
  plan?: DashboardPlan;
  revision?: number;
}> {
  static type = 'dashboard-planning';
}

/**
 * An editable preview's plan changed; GET_PLAN reads it. A type of its own rather than another
 * DashboardPlanningEvent action, since a listener that predates it handles every action it does not
 * know as a dismissal.
 */
export class DashboardPlanChangedEvent extends BusEventWithPayload<{ planId: string; revision: number }> {
  static type = 'dashboard-plan-changed';
}
