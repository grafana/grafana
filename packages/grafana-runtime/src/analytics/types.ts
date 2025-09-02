import { CoreApp } from '@grafana/data';

import { EchoEvent, EchoEventType } from '../services/EchoSrv';

/**
 * Describes the basic dashboard information that can be passed as the meta
 * analytics payload.
 *
 * @public
 */
export interface DashboardInfo {
  /** @deprecated -- use UID not internal ID */
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
  source?: CoreApp | string;
  datasourceName: string;
  datasourceId: number;
  datasourceUid: string;
  datasourceType: string;
  panelId?: number;
  panelPluginId?: string;
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

/**
 * Describes performance metrics for an individual panel during dashboard rendering.
 * Used to track fine-grained performance data at the panel level.
 *
 * @public
 */
export interface PanelPerformanceData {
  /** Legacy panel ID from the dashboard model */
  panelId: string;
  /** Scene object key for the panel */
  panelKey: string;
  /** Panel plugin type (e.g., 'timeseries', 'table', 'gauge') */
  pluginId: string;
  /** Version of the panel plugin */
  pluginVersion?: string;

  // Timing metrics (all in milliseconds)
  /** Time taken to load the panel plugin */
  pluginLoadTime: number;
  /** Whether the plugin was loaded from cache rather than fetched/imported */
  pluginLoadedFromCache: boolean;
  /** Time spent executing data queries */
  queryTime: number;
  /** Time spent processing data (field config, transformations) */
  dataProcessingTime: number;
  /** Time spent rendering the panel to DOM */
  renderTime: number;
  /** Total time for all panel operations */
  totalTime: number;

  // Performance metrics
  /** Number of long frames (>50ms) during panel operations */
  longFramesCount: number;
  /** Total time of all long frames for this panel */
  longFramesTotalTime: number;
  /** Number of times this panel was rendered during the interaction */
  renderCount: number;

  // Additional context
  /** Number of data points processed by the panel */
  dataPointsCount?: number;
  /** Number of series/fields in the panel data */
  seriesCount?: number;
  /** Error message if panel failed to load or render */
  error?: string;
  /** Memory increase during panel operations (bytes) */
  memoryIncrease?: number;
}
