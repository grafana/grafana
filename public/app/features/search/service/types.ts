import { DataFrameView, SelectableValue } from '@grafana/data';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';

export interface FacetField {
  field: string;
  count?: number;
}

export interface SearchQuery {
  query?: string;
  location?: string;
  sort?: string;
  ds_uid?: string;
  tags?: string[];
  kind?: string[];
  panel_type?: string;
  uid?: string[];
  facet?: FacetField[];
  explain?: boolean;
  withAllowedActions?: boolean;
  accessInfo?: boolean;
  hasPreview?: string; // theme
  limit?: number;
  from?: number;
  starred?: boolean;
}

export interface DashboardQueryResult {
  kind: string; // panel, dashboard, folder
  name: string;
  uid: string;
  url: string; // link to value (unique)
  panel_type: string;
  tags: string[];
  location: string; // url that can be split
  ds_uid: string[];

  // debugging fields
  score: number;
  explain: {};
}

export interface LocationInfo {
  kind: string;
  name: string;
  url: string;
}

export interface SearchResultMeta {
  count: number;
  max_score: number;
  locationInfo: Record<string, LocationInfo>;
  sortBy?: string;
}

export interface QueryResponse {
  view: DataFrameView<DashboardQueryResult>;

  /** Supports lazy loading.  This will mutate the `view` object above, adding rows as needed */
  loadMoreItems: (startIndex: number, stopIndex: number) => Promise<void>;

  /** Checks if a row in the view needs to be added */
  isItemLoaded: (index: number) => boolean;

  /** the total query results size */
  totalRows: number;
}

export interface GrafanaSearcher {
  search: (query: SearchQuery) => Promise<QueryResponse>;
  starred: (query: SearchQuery) => Promise<QueryResponse>;
  tags: (query: SearchQuery) => Promise<TermCount[]>;
  getSortOptions: () => Promise<SelectableValue[]>;
}
