import { type WithAccessControlMetadata } from '@grafana/data';

import { type ManagerKind } from '../apiserver/types';

import { type QueryResponse } from './service/types';

export enum DashboardSearchItemType {
  DashDB = 'dash-db',
  DashHome = 'dash-home',
  DashFolder = 'dash-folder',
}

/**
 * @deprecated Use DashboardSearchItem and use UIDs instead of IDs
 * DTO type for search API result items, but with deprecated IDs
 * This type was previously also used heavily for views, so contains lots of
 * extraneous properties
 */
export interface DashboardSearchHit extends WithAccessControlMetadata {
  /** @deprecated use folderUid */
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id?: number;
  tags: string[];
  title: string;
  type: DashboardSearchItemType;
  uid: string;
  url: string;
  sortMeta?: number;
  sortMetaName?: string;
  isDeleted?: boolean;
  permanentlyDeleteDate?: string;
}

/**
 * DTO type for search API result items
 * This should not be used directly - use GrafanaSearcher instead and get a DashboardQueryResult
 */
export interface DashboardSearchItem {
  uid: string;
  title: string;
  uri: string;
  url: string;
  type: string; // dash-db, dash-home
  tags: string[];
  isStarred: boolean;

  // Only on dashboards in folders results
  folderUid?: string;
  folderTitle?: string;
  folderUrl?: string;
}

export type DashboardViewItemKind = 'folder' | 'dashboard' | 'panel';

/**
 * Type used in the folder view components
 */
export interface DashboardViewItem {
  kind: DashboardViewItemKind;
  uid: string;
  title: string;
  url?: string;
  tags?: string[];

  icon?: string;

  parentUID?: string;
  /** @deprecated Not used in new Browse UI */
  parentTitle?: string;
  /** @deprecated Not used in new Browse UI */
  parentKind?: string;

  // Used only for psuedo-folders, such as Starred or Recent
  /** @deprecated Not used in new Browse UI */
  itemsUIDs?: string[];

  // For enterprise sort options
  sortMeta?: number | string; // value sorted by
  sortMetaName?: string; // name of the value being sorted e.g. 'Views'
  managedBy?: ManagerKind;

  ownerReference?: {
    kind: string;
    uid: string;
    title: string;
    avatarUrl?: string;
  };
}

export type EventTrackingNamespace = 'manage_dashboards' | 'dashboard_search';

export interface SearchState {
  query: string;
  tag: string[];
  // Owner of the folder. Currently, there can be only teams, so the format of each ref
  // is "iam.grafana.app/Team/{teamUID}"
  ownerReference?: string[];
  starred: boolean;
  explain?: boolean; // adds debug info
  datasource?: string;
  panel_type?: string;
  createdBy?: string;
  sort?: string;
  prevSort?: string; // Save sorting data between layouts
  layout: SearchLayout;
  result?: QueryResponse;
  loading?: boolean;
  folderUid?: string;
  includePanels?: boolean;
  eventTrackingNamespace: EventTrackingNamespace;
  deleted: boolean;
}

export enum SearchLayout {
  List = 'list',
  Folders = 'folders',
}

export interface SearchQueryParams {
  query?: string | null;
  sort?: string | null;
  starred?: boolean | null;
  tag?: string[] | null;
  ownerReference?: string[] | null;
  layout?: SearchLayout | null;
  folder?: string | null;
  createdBy?: string | null;
}
