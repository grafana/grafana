import { reportMetaAnalytics, MetaAnalyticsEventName } from '@grafana/runtime';
export function emitDashboardViewEvent(dashboard) {
    var eventData = {
        dashboardId: dashboard.id,
        dashboardName: dashboard.title,
        dashboardUid: dashboard.uid,
        folderName: dashboard.meta.folderTitle,
        eventName: MetaAnalyticsEventName.DashboardView,
    };
    reportMetaAnalytics(eventData);
}
//# sourceMappingURL=analyticsProcessor.js.map