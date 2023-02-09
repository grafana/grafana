import { Action } from 'redux';

import { WithAccessControlMetadata } from '@grafana/data';

import { NestedFolderItem, QueryResponse } from './service';

export enum DashboardSearchItemType {
  DashDB = 'dash-db',
  DashHome = 'dash-home',
  DashFolder = 'dash-folder',
}

/**
 * @deprecated Use DashboardSearchItem and use UIDs instead of IDs
 */
export interface DashboardSearchHit extends WithAccessControlMetadata {
  expanded?: boolean;
  score?: number;
  slug?: string;
  itemsFetching?: boolean;

  checked?: boolean;
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id?: number;
  isStarred: boolean;
  selected?: boolean;
  tags: string[];
  title: string;
  type: DashboardSearchItemType;
  icon?: string;
  uid?: string;
  uri: string;
  url: string;
  sortMeta?: number;
  sortMetaName?: string;
}

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
  sort?: string;
  prevSort?: string; // Save sorting data between layouts
  layout: SearchLayout;
  result?: QueryResponse;
  loading?: boolean;
  folderUid?: string;
  includePanels?: boolean;
  eventTrackingNamespace: EventTrackingNamespace;
}

export type OnToggleChecked = (item: NestedFolderItem) => void;

export enum SearchLayout {
  List = 'list',
  Folders = 'folders',
  Grid = 'grid', // preview
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
