import { AnnotationEvent, PanelData, TimeRange } from '@grafana/data';

import { DashboardModel } from '../dashboard/state/DashboardModel';
import { PanelModel } from '../dashboard/state/PanelModel';

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

export interface AnnotationTag {
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
