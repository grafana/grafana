import { BusEventWithPayload } from '@grafana/data';

export class DashboardPlanningEvent extends BusEventWithPayload<{
  planId: string;
  action: 'build' | 'dismiss' | 'closed';
}> {
  static type = 'dashboard-planning';
}
