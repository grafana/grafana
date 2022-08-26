import { Action } from 'redux';

import { SelectableValue, WithAccessControlMetadata } from '@grafana/data';

export enum DashboardSearchItemType {
  DashDB = 'dash-db',
  DashHome = 'dash-home',
  DashFolder = 'dash-folder',
}

/**
 * @deprecated
 */
export interface DashboardSection {
  id?: number;
  uid?: string;
  title: string;
  expanded?: boolean;
  url: string;
  icon?: string;
  score?: number;
  checked?: boolean;
  items: DashboardSectionItem[];
  toggle?: (section: DashboardSection) => Promise<DashboardSection>;
  selected?: boolean;
  type: DashboardSearchItemType;
  slug?: string;
  itemsFetching?: boolean;
}

/**
 * @deprecated
 */
export interface DashboardSectionItem {
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
  icon?: string; // used for grid view
  uid?: string;
  uri: string;
  url: string;
  sortMeta?: number;
  sortMetaName?: string;
}

/**
 * @deprecated - It uses dashboard ID which is depreacted in favor of dashboard UID. Please, use DashboardSearchItem instead.
 */
export interface DashboardSearchHit extends DashboardSectionItem, DashboardSection, WithAccessControlMetadata {}

export interface DashboardSearchItem
  extends Omit<
    DashboardSearchHit,
    'id' | 'uid' | 'expanded' | 'selected' | 'checked' | 'folderId' | 'icon' | 'sortMeta' | 'sortMetaName'
  > {
  uid: string;
}

export interface SearchAction extends Action {
  payload?: any;
}

export interface DashboardQuery {
  query: string;
  tag: string[];
  starred: boolean;
  explain?: boolean; // adds debug info
  datasource?: string;
  sort: SelectableValue | null;
  // Save sorting data between layouts
  prevSort: SelectableValue | null;
  layout: SearchLayout;
}

export type OnToggleChecked = (item: DashboardSectionItem | DashboardSection) => void;

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
