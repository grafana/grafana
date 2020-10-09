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

export interface GrafanaAnnotationQuery extends AnnotationQuery<GrafanaQuery> {
  type: GrafanaAnnotationType; // tags
  limit: number; // 100
  tags?: string[];
  matchAny?: boolean; // By default Grafana only shows annotations that match all tags in the query. Enabling this returns annotations that match any of the tags in the query.
}
