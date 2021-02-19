import { getDashboardSrv } from '../services/DashboardSrv';

import { PanelData, LoadingState, DataSourceApi } from '@grafana/data';

import { reportMetaAnalytics, MetaAnalyticsEventPayload } from '@grafana/runtime';

export function getAnalyticsProcessor(datasource: DataSourceApi) {
  let done = false;

  return (data: PanelData) => {
    if (!data.request || done) {
      return;
    }

    if (data.state !== LoadingState.Done && data.state !== LoadingState.Error) {
      return;
    }

    const eventData: MetaAnalyticsEventPayload = {
      datasourceName: datasource.name,
      datasourceId: datasource.id,
      panelId: data.request.panelId,
      dashboardId: data.request.dashboardId,
      // app: 'dashboard',
      dataSize: 0,
      duration: data.request.endTime - data.request.startTime,
      eventName: 'data-request',
      // sessionId: '',
    };

    // enrich with dashboard info
    const dashboard = getDashboardSrv().getCurrent();
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
