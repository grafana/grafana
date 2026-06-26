import { reportMetaAnalytics, MetaAnalyticsEventName, DashboardViewEventPayload } from '@grafana/runtime';

import { DashboardModel } from './DashboardModel';

export function emitDashboardViewEvent(dashboard: Pick<DashboardModel, 'id' | 'title' | 'uid' | 'meta'>) {
  const eventData: DashboardViewEventPayload = {
    /** @deprecated */
    dashboardId: dashboard.id,
    dashboardName: dashboard.title,
    dashboardUid: dashboard.uid,
    folderName: dashboard.meta.folderTitle,
    eventName: MetaAnalyticsEventName.DashboardView,
  };

  reportMetaAnalytics(eventData);
}
