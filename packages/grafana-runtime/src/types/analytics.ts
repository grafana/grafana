import { EchoEvent, EchoEventType } from '../services/EchoSrv';

export interface MetaAnalyticsEventPayload {
  eventName: string;
  dashboardId?: number;
  dashboardUid?: string;
  dashboardName?: string;
  folderName?: string;
  panelId?: number;
  panelName?: string;
  datasourceName: string;
  datasourceId?: number;
  error?: string;
  duration: number;
  dataSize?: number;
}

export interface MetaAnalyticsEvent extends EchoEvent<EchoEventType.MetaAnalytics, MetaAnalyticsEventPayload> {}
