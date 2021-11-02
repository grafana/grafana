import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { LoadingState, CoreApp, urlUtil } from '@grafana/data';
import { reportMetaAnalytics, MetaAnalyticsEventName } from '@grafana/runtime';
export function emitDataRequestEvent(datasource) {
    var done = false;
    return function (data) {
        if (!data.request || done || data.request.app === CoreApp.Explore) {
            return;
        }
        var params = urlUtil.getUrlSearchParams();
        if (params.editPanel != null) {
            return;
        }
        if (data.state !== LoadingState.Done && data.state !== LoadingState.Error) {
            return;
        }
        var eventData = {
            eventName: MetaAnalyticsEventName.DataRequest,
            datasourceName: datasource.name,
            datasourceId: datasource.id,
            datasourceType: datasource.type,
            panelId: data.request.panelId,
            dashboardId: data.request.dashboardId,
            dataSize: 0,
            duration: data.request.endTime - data.request.startTime,
        };
        // enrich with dashboard info
        var dashboard = getDashboardSrv().getCurrent();
        if (dashboard) {
            eventData.dashboardId = dashboard.id;
            eventData.dashboardName = dashboard.title;
            eventData.dashboardUid = dashboard.uid;
            eventData.folderName = dashboard.meta.folderTitle;
        }
        if (data.series && data.series.length > 0) {
            // estimate size
            eventData.dataSize = data.series.length;
        }
        if (data.error) {
            eventData.error = data.error.message;
        }
        reportMetaAnalytics(eventData);
        // this done check is to make sure we do not double emit events in case
        // there are multiple responses with done state
        done = true;
    };
}
//# sourceMappingURL=queryAnalytics.js.map