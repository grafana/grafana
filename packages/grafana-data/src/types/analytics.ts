import { eventFactory } from './utils';

export interface AnalyticsEvent {
  userLogin: string;
  userId: number;
  userSignedIn: boolean;
  timestamp: number;
  /**
   * Event name
   */
  eventName: string;
  /**
   * A unique browser session
   */
  sessionId: string;
  /**
   * Originating Grafana app, dashboard | explore
   */
  app: string;
  /**
   * if > 1 the event represents a combined number of events
   */
  count: number;
}

export interface DataRequestAnalyticsEvent extends AnalyticsEvent {
  dashboardId?: number;
  dashboardUid?: string;
  dashboardName?: string;
  folderName?: string;
  panelId?: number;
  panelName?: string;
  datasourceName: string;
  datasourceId?: number;
  error?: string;
  requestMs: number;
  dataSize: number;
}

export const dataRequestAnalyticsEvent = eventFactory<DataRequestAnalyticsEvent>('data-request-analytics');
