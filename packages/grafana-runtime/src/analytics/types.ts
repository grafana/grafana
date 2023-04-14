import { CoreApp } from '@grafana/data';

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
  publicDashboardUid?: string;
}

/**
 * Describes the data request information passed as the meta analytics payload.
 *
 * @public
 */
export interface DataRequestInfo extends Partial<DashboardInfo> {
  source?: CoreApp | string;
  datasourceName: string;
  datasourceId: number;
  datasourceUid: string;
  datasourceType: string;
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
  totalQueries?: number;
  cachedQueries?: number;
}

/**
 * Describes the meta analytics payload passed with the {@link MetaAnalyticsEvent}
 *
 * @public
 */
export type MetaAnalyticsEventPayload = DashboardViewEventPayload | DataRequestEventPayload;

/**
 * Describes meta analytics event with predefined {@link EchoEventType.EchoEventType} type.
 *
 * @public
 */
export interface MetaAnalyticsEvent extends EchoEvent<EchoEventType.MetaAnalytics, MetaAnalyticsEventPayload> {}

/**
 * Describes the payload of a pageview event.
 *
 * @public
 */
export interface PageviewEchoEventPayload {
  page: string;
}

/**
 * Describes pageview event with predefined {@link EchoEventType.EchoEventType} type.
 *
 * @public
 */
export type PageviewEchoEvent = EchoEvent<EchoEventType.Pageview, PageviewEchoEventPayload>;

/**
 * Describes the payload of a user interaction event.
 *
 * @public
 */
export interface InteractionEchoEventPayload {
  interactionName: string;
  properties?: Record<string, any>;
}

/**
 * Describes interaction event with predefined {@link EchoEventType.EchoEventType} type.
 *
 * @public
 */
export type InteractionEchoEvent = EchoEvent<EchoEventType.Interaction, InteractionEchoEventPayload>;

/**
 * Describes the payload of an experimentview event.
 *
 * @public
 */
export interface ExperimentViewEchoEventPayload {
  experimentId: string;
  experimentGroup: string;
  experimentVariant: string;
}

/**
 * Describes experimentview event with predefined {@link EchoEventType.EchoEventType} type.
 *
 * @public
 */
export type ExperimentViewEchoEvent = EchoEvent<EchoEventType.ExperimentView, ExperimentViewEchoEventPayload>;

/**
 * Pageview event typeguard.
 *
 * @public
 */
export const isPageviewEvent = (event: EchoEvent): event is PageviewEchoEvent => {
  return Boolean(event.payload.page);
};

/**
 * Interaction event typeguard.
 *
 * @public
 */
export const isInteractionEvent = (event: EchoEvent): event is InteractionEchoEvent => {
  return Boolean(event.payload.interactionName);
};

/**
 * Experimentview event typeguard.
 *
 * @public
 */
export const isExperimentViewEvent = (event: EchoEvent): event is ExperimentViewEchoEvent => {
  return Boolean(event.payload.experimentId);
};
