import { type AnnotationEvent, type PanelData, type TimeRange } from '@grafana/data';

import { type DashboardModel } from '../dashboard/state/DashboardModel';

export interface AnnotationQueryOptions {
  dashboard: DashboardModel;
  panel: object;
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

interface AnnotationTag {
  /**
   * The tag name
   */
  tag: string;
  /**
   * The number of occurrences of that tag
   */
  count: number;
}

export interface AnnotationTagsResponse {
  result: {
    tags: AnnotationTag[];
  };
}
