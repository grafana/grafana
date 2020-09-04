import { DataQueryError, DataFrame, AnnotationEvent, LoadingState, TimeRange } from '@grafana/data';
import { DashboardModel, PanelModel } from '../dashboard/state';

export interface AnnotationQueryOptions {
  dashboard: DashboardModel;
  panel: PanelModel;
  range: TimeRange;
}

export interface AnnotationQueryResponse {
  /**
   * Optionally return the original data frames
   */
  data?: DataFrame; // Multiple frames will always be joined first

  /**
   * The processed annotation events
   */
  events?: AnnotationEvent[];

  /**
   * Optionally include error info along with the response data
   */
  error?: DataQueryError;

  /**
   * Use this to control which state the response should have
   * Defaults to LoadingState.Done if state is not defined
   */
  state?: LoadingState;
}
