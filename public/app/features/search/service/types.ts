import { ManagedBy } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { DataFrameView, SelectableValue } from '@grafana/data';
import { TermCount } from 'app/core/components/TagFilter/TagFilter';
import { PermissionLevel } from 'app/types/acl';

import { ManagerKind } from '../../apiserver/types';

export interface SortOption {
  description: string;
  displayName: string;
  meta: string;
  name: string;
}
export interface SortOptions {
  sortOptions: SortOption[];
}

export interface FacetField {
  field: string;
  count?: number;
}

export interface SearchQuery {
  query?: string;
  location?: string; // folder!
  sort?: string;
  ds_uid?: string;
  ds_type?: string;
  tags?: string[];
  kind?: string[];
  panel_type?: string;
  name?: string[];
  uid?: string[];
  facet?: FacetField[];
  explain?: boolean;
  panelTitleSearch?: boolean;
  withAllowedActions?: boolean;
  accessInfo?: boolean;
  limit?: number;
  from?: number;
  starred?: boolean;
  permission?: PermissionLevel;
  deleted?: boolean;
  offset?: number;
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
  isDeleted?: boolean;
  permanentlyDeleteDate?: Date;

  // debugging fields
  score: number;
  explain: {};
  /**
   * Who manages this resource (e.g. provisioning). From unified search this is
   * the full object { kind, id }; from legacy or other paths it may be just the
   * kind string (ManagerKind). Use typeof item.managedBy === 'string' or
   * item.managedBy?.kind when normalizing.
   */
  managedBy?: ManagedBy | ManagerKind;

  // enterprise sends extra properties through for sorting (views, errors, etc)
  [key: string]: unknown;
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
  sortPlaceholder?: string;
  getLocationInfo: () => Promise<Record<string, LocationInfo>>;

  /** Gets the default sort used for the Folder view */
  getFolderViewSort: () => string;
}

export interface NestedFolderDTO {
  uid: string;
  title: string;
  /**
   * Who manages this resource (e.g. provisioning). From unified search this is
   * the full object { kind, id }; from legacy or other paths it may be just the
   * kind string (ManagerKind). Use typeof item.managedBy === 'string' or
   * item.managedBy?.kind when normalizing.
   */
  managedBy?: ManagedBy | ManagerKind;
}
