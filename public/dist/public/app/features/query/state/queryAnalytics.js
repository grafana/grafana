import { LoadingState, CoreApp, urlUtil } from '@grafana/data';
import { reportMetaAnalytics, MetaAnalyticsEventName } from '@grafana/runtime';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
export function emitDataRequestEvent(datasource) {
    let done = false;
    return (data) => {
        if (!data.request || done) {
            return;
        }
        const params = urlUtil.getUrlSearchParams();
        if (params.editPanel != null) {
            return;
        }
        if (data.state !== LoadingState.Done && data.state !== LoadingState.Error) {
            return;
        }
        const eventData = {
            eventName: MetaAnalyticsEventName.DataRequest,
            source: data.request.app,
            datasourceName: datasource.name,
            datasourceId: datasource.id,
            datasourceUid: datasource.uid,
            datasourceType: datasource.type,
            dataSize: 0,
            duration: data.request.endTime - data.request.startTime,
        };
        if (data.request.app === CoreApp.Explore || data.request.app === CoreApp.Correlations) {
            enrichWithInfo(eventData, data);
        }
        else {
            enrichWithDashboardInfo(eventData, data);
        }
        if (data.series && data.series.length > 0) {
            // estimate size
            eventData.dataSize = data.series.length;
        }
        reportMetaAnalytics(eventData);
        // this done check is to make sure we do not double emit events in case
        // there are multiple responses with done state
        done = true;
    };
    function enrichWithInfo(eventData, data) {
        const totalQueries = Object.keys(data.series).length;
        eventData.totalQueries = totalQueries;
    }
    function enrichWithDashboardInfo(eventData, data) {
        var _a, _b;
        const queryCacheStatus = {};
        for (let i = 0; i < data.series.length; i++) {
            const refId = data.series[i].refId;
            if (refId && !queryCacheStatus[refId]) {
                queryCacheStatus[refId] = (_b = (_a = data.series[i].meta) === null || _a === void 0 ? void 0 : _a.isCachedResponse) !== null && _b !== void 0 ? _b : false;
            }
        }
        const totalQueries = Object.keys(queryCacheStatus).length;
        const cachedQueries = Object.values(queryCacheStatus).filter((val) => val === true).length;
        eventData.panelId = data.request.panelId;
        eventData.totalQueries = totalQueries;
        eventData.cachedQueries = cachedQueries;
        const dashboard = getDashboardSrv().getCurrent();
        if (dashboard) {
            eventData.dashboardId = dashboard.id;
            eventData.dashboardName = dashboard.title;
            eventData.dashboardUid = dashboard.uid;
            eventData.folderName = dashboard.meta.folderTitle;
        }
        if (data.error) {
            eventData.error = data.error.message;
        }
    }
}
//# sourceMappingURL=queryAnalytics.js.map