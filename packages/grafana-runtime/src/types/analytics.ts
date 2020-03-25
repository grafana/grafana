import { EchoEvent, EchoEventType } from '../services/EchoSrv';

export interface DashboardInfo {
  dashboardId: number;
  dashboardUid: string;
  dashboardName: string;
  folderName?: string;
}

export interface DataRequestInfo extends Partial<DashboardInfo> {
  datasourceName: string;
  datasourceId?: number;
  panelId?: number;
  panelName?: string;
  duration: number;
  error?: string;
  dataSize?: number;
}

export enum MetaAnalyticsEventName {
  DashboardView = 'dashboard-view',
  DataRequest = 'data-request',
}

export interface DashboardViewEventPayload extends DashboardInfo {
  eventName: MetaAnalyticsEventName.DashboardView;
}

export interface DataRequestEventPayload extends DataRequestInfo {
  eventName: MetaAnalyticsEventName.DataRequest;
}

export type MetaAnalyticsEventPayload = DashboardViewEventPayload | DataRequestEventPayload;

export interface MetaAnalyticsEvent extends EchoEvent<EchoEventType.MetaAnalytics, MetaAnalyticsEventPayload> {}
