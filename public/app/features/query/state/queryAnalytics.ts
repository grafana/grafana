import { PanelData, LoadingState, DataSourceApi, CoreApp, urlUtil } from '@grafana/data';
import { reportMetaAnalytics, MetaAnalyticsEventName, DataRequestEventPayload } from '@grafana/runtime';

import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';

export function emitDataRequestEvent(datasource: DataSourceApi) {
  let done = false;

  return (data: PanelData) => {
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

    const eventData: DataRequestEventPayload = {
      eventName: MetaAnalyticsEventName.DataRequest,
      source: data.request.app,
      datasourceName: datasource.name,
      datasourceId: datasource.id,
      datasourceUid: datasource.uid,
      datasourceType: datasource.type,
      dataSize: 0,
      duration: data.request.endTime! - data.request.startTime,
    };

    if (data.request.app === CoreApp.Explore || data.request.app === CoreApp.Correlations) {
      enrichWithInfo(eventData, data);
    } else {
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

  function enrichWithInfo(eventData: DataRequestEventPayload, data: PanelData) {
    const totalQueries = Object.keys(data.series).length;
    eventData.totalQueries = totalQueries;
  }

  function enrichWithDashboardInfo(eventData: DataRequestEventPayload, data: PanelData) {
    const queryCacheStatus: { [key: string]: boolean } = {};
    for (let i = 0; i < data.series.length; i++) {
      const refId = data.series[i].refId;
      if (refId && !queryCacheStatus[refId]) {
        queryCacheStatus[refId] = data.series[i].meta?.isCachedResponse ?? false;
      }
    }
    const totalQueries = Object.keys(queryCacheStatus).length;
    const cachedQueries = Object.values(queryCacheStatus).filter((val) => val === true).length;

    eventData.panelId = data.request!.panelId;
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
