import { reportMetaAnalytics, MetaAnalyticsEventName, DashboardViewEventPayload } from '@grafana/runtime';

import { DashboardModel } from './DashboardModel';

export function emitDashboardViewEvent(dashboard: Pick<DashboardModel, 'title' | 'uid' | 'meta' | 'id'>) {
  const eventData: DashboardViewEventPayload = {
    dashboardId: dashboard.id,
    dashboardName: dashboard.title,
    dashboardUid: dashboard.uid,
    folderName: dashboard.meta.folderTitle,
    eventName: MetaAnalyticsEventName.DashboardView,
  };

  reportMetaAnalytics(eventData);
}
