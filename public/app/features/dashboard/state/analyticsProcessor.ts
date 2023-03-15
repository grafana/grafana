import { reportMetaAnalytics, MetaAnalyticsEventName, DashboardViewEventPayload } from '@grafana/runtime';

import { DashboardModel } from './DashboardModel';

export function emitDashboardViewEvent(dashboard: DashboardModel) {
  const eventData: DashboardViewEventPayload = {
    dashboardName: dashboard.title,
    dashboardUid: dashboard.uid,
    folderName: dashboard.meta.folderTitle,
    eventName: MetaAnalyticsEventName.DashboardView,
  };

  reportMetaAnalytics(eventData);
}
