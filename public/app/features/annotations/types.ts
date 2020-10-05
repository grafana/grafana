import { PanelData, AnnotationEvent, TimeRange } from '@grafana/data';
import { DashboardModel, PanelModel } from '../dashboard/state';

export interface AnnotationQueryOptions {
  dashboard: DashboardModel;
  panel: PanelModel;
  range: TimeRange;
}

export interface AnnotationQueryResponse {
  /**
   * The processed annotation events
   */
  events?: AnnotationEvent[];

  /**
   * The original panel response
   */
  panelData?: PanelData;
}
