import { DataFrame, DataSourceRef } from '@grafana/data';

export interface QueryResult {
  kind: string; // panel, dashboard, folder
  name: string;
  description?: string;
  url: string; // link to value (unique)
  tags?: string[];
  location?: LocationInfo[]; // the folder name
  datasource?: DataSourceRef[];
  score?: number;
}

export interface LocationInfo {
  kind: 'folder' | 'dashboard';
  name: string;
}

export interface QueryFilters {
  kind?: string; // limit to a single type
  tags?: string[]; // match all tags
  datasource?: string; // limit to a single datasource
}

export interface QueryResponse {
  body: DataFrame;
}

export interface GrafanaSearcher {
  search: (query: string, filter?: QueryFilters) => Promise<QueryResponse>;
}
