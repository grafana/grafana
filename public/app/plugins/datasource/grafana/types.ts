import { AnnotationQuery, DataQuery } from '@grafana/data';

//----------------------------------------------
// Query
//----------------------------------------------

export enum GrafanaQueryType {
  RandomWalk = 'randomWalk',
  RandomStream = 'randomStream',
  HostMetrics = 'hostmetrics',
}

export interface GrafanaQuery extends DataQuery {
  queryType: GrafanaQueryType; // RandomWalk by default
}

export const defaultQuery: GrafanaQuery = {
  refId: 'A',
  queryType: GrafanaQueryType.RandomWalk,
};

//----------------------------------------------
// Annotations
//----------------------------------------------

export enum GrafanaAnnotationType {
  Dashboard = 'dashboard',
  Tags = 'tags',
}

export interface GrafanaAnnotaitonQuery extends AnnotationQuery<GrafanaQuery> {
  type: GrafanaAnnotationType; // tags
  limit: number; // 100
}
