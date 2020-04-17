import { EchoEvent, EchoEventType } from '../services/EchoSrv';

/**
 * Describes the basic dashboard information that can be passed as the meta
 * analytics payload.
 *
 * @public
 */
export interface DashboardInfo {
  dashboardId: number;
  dashboardUid: string;
  dashboardName: string;
  folderName?: string;
}

/**
 * Describes the data request information passed as the meta analytics payload.
 *
 * @public
 */
export interface DataRequestInfo extends Partial<DashboardInfo> {
  datasourceName: string;
  datasourceId?: number;
  panelId?: number;
  panelName?: string;
  duration: number;
  error?: string;
  dataSize?: number;
}

/**
 * The meta analytics events that can be added to the echo service.
 *
 * @public
 */
export enum MetaAnalyticsEventName {
  DashboardView = 'dashboard-view',
  DataRequest = 'data-request',
}

/**
 * Describes the payload of a dashboard view event.
 *
 * @public
 */
export interface DashboardViewEventPayload extends DashboardInfo {
  eventName: MetaAnalyticsEventName.DashboardView;
}

/**
 * Describes the payload of a data request event.
 *
 * @public
 */
export interface DataRequestEventPayload extends DataRequestInfo {
  eventName: MetaAnalyticsEventName.DataRequest;
}

/**
 * Describes the meta analytics payload passed with the {@link MetaAnalyticsEvent}
 *
 * @public
 */
export type MetaAnalyticsEventPayload = DashboardViewEventPayload | DataRequestEventPayload;

/**
 * Describes meta analytics event with predefined {@link EchoEventType.MetaAnalytics} type.
 *
 * @public
 */
export interface MetaAnalyticsEvent extends EchoEvent<EchoEventType.MetaAnalytics, MetaAnalyticsEventPayload> {}
