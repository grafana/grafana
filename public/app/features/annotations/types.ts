import { PanelData, DataFrame, AnnotationEvent, TimeRange } from '@grafana/data';
import { DashboardModel, PanelModel } from '../dashboard/state';

export interface AnnotationQueryOptions {
  dashboard: DashboardModel;
  panel: PanelModel;
  range: TimeRange;
}

export interface AnnotationQueryResponse {
  /**
   * All the data flattened to a single frame
   */
  frame?: DataFrame;

  /**
   * The processed annotation events
   */
  events?: AnnotationEvent[];

  /**
   * The original panel response
   */
  panelData?: PanelData;
}
