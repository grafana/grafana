import { Action } from 'redux';

import { WithAccessControlMetadata } from '@grafana/data';

import { QueryResponse } from './service';

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
  parentTitle?: string;
  parentKind?: string;

  // Used only for psuedo-folders, such as Starred or Recent
  itemsUIDs?: string[];

  // For enterprise sort options
  sortMeta?: number | string; // value sorted by
  sortMetaName?: string; // name of the value being sorted e.g. 'Views'
}

export interface SearchAction extends Action {
  payload?: any;
}

export type EventTrackingNamespace = 'manage_dashboards' | 'dashboard_search';

export interface SearchState {
  query: string;
  tag: string[];
  starred: boolean;
  explain?: boolean; // adds debug info
  datasource?: string;
  panel_type?: string;
  sort?: string;
  prevSort?: string; // Save sorting data between layouts
  layout: SearchLayout;
  result?: QueryResponse;
  loading?: boolean;
  folderUid?: string;
  includePanels?: boolean;
  eventTrackingNamespace: EventTrackingNamespace;
}

export type OnToggleChecked = (item: DashboardViewItem) => void;

export enum SearchLayout {
  List = 'list',
  Folders = 'folders',
}

export interface SearchQueryParams {
  query?: string | null;
  sort?: string | null;
  starred?: boolean | null;
  tag?: string[] | null;
  layout?: SearchLayout | null;
  folder?: string | null;
}

// new Search Types
export type OnMoveOrDeleleSelectedItems = () => void;
