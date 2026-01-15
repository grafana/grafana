import { DataFrameJSON } from '@grafana/data';
import { LiveDataFilter } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { TimeRegionConfig } from 'app/core/utils/timeRegions';
import { SearchQuery } from 'app/features/search/service/types';

//----------------------------------------------
// Query
//----------------------------------------------

export enum GrafanaQueryType {
  LiveMeasurements = 'measurements',
  Annotations = 'annotations',
  Snapshot = 'snapshot',
  TimeRegions = 'timeRegions',

  // backend
  RandomWalk = 'randomWalk',
  List = 'list',
  Read = 'read',
  Search = 'search',
  SearchNext = 'searchNext',
}

export interface GrafanaQuery extends DataQuery {
  queryType: GrafanaQueryType; // RandomWalk by default
  channel?: string;
  filter?: LiveDataFilter;
  buffer?: number;
  path?: string; // for list and read
  search?: SearchQuery;
  searchNext?: SearchQuery;
  snapshot?: DataFrameJSON[];
  timeRegion?: TimeRegionConfig;
  file?: GrafanaQueryFile;
  // Random walk configuration
  seriesCount?: number;
  startValue?: number;
  min?: number;
  max?: number;
  spread?: number;
  noise?: number;
  dropPercent?: number;
}

export interface GrafanaQueryFile {
  name: string;
  size: number;
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

export interface GrafanaAnnotationQuery extends GrafanaQuery {
  type: GrafanaAnnotationType; // tags
  limit: number; // 100
  tags?: string[];
  matchAny?: boolean; // By default Grafana only shows annotations that match all tags in the query. Enabling this returns annotations that match any of the tags in the query.
}
