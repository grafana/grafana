import { DashboardModel } from './DashboardModel';
import { reportMetaAnalytics, MetaAnalyticsEventName, DashboardViewEventPayload } from '@grafana/runtime';

export function emitDashboardViewEvent(dashboard: DashboardModel) {
  const eventData: DashboardViewEventPayload = {
    dashboardId: dashboard.id,
    dashboardName: dashboard.title,
    dashboardUid: dashboard.uid,
    folderName: dashboard.meta.folderTitle,
    eventName: MetaAnalyticsEventName.DashboardView,
  };

  reportMetaAnalytics(eventData);
}
