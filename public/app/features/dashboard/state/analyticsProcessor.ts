import { getDashboardSrv } from '../services/DashboardSrv';
import { DashboardModel } from './DashboardModel';

import { PanelData, LoadingState, DataSourceApi } from '@grafana/data';

import {
  reportMetaAnalytics,
  MetaAnalyticsEventName,
  DataRequestEventPayload,
  DashboardViewEventPayload,
} from '@grafana/runtime';

export function emitDataRequestEvent(datasource: DataSourceApi) {
  let done = false;

  return (data: PanelData) => {
    if (!data.request || done) {
      return;
    }

    if (data.request.exploreMode) {
      return;
    }

    if (data.state !== LoadingState.Done && data.state !== LoadingState.Error) {
      return;
    }

    const eventData: DataRequestEventPayload = {
      eventName: MetaAnalyticsEventName.DataRequest,
      datasourceName: datasource.name,
      datasourceId: datasource.id,
      panelId: data.request.panelId,
      dashboardId: data.request.dashboardId,
      dataSize: 0,
      duration: data.request.endTime - data.request.startTime,
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
