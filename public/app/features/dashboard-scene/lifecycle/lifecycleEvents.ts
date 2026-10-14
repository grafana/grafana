import { BusEventWithPayload } from '@grafana/data';

/**
 * A draft was published or discarded from the dashboard page. Plugins that show the dashboard's
 * state, such as Grafana Assistant's chat, match it by its `type` and refresh it.
 */
export class DashboardLifecycleChangedEvent extends BusEventWithPayload<{
  uid: string;
  change: 'published' | 'discarded';
}> {
  static type = 'dashboard-lifecycle-changed';
}
