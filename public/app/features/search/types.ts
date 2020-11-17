import { Dispatch } from 'react';
import { Action } from 'redux';
import { SelectableValue } from '@grafana/data';
import { FolderInfo } from '../../types';

export enum DashboardSearchItemType {
  DashDB = 'dash-db',
  DashHome = 'dash-home',
  DashFolder = 'dash-folder',
}

export interface DashboardSection {
  id: number;
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

export interface DashboardSectionItem {
  checked?: boolean;
  folderId?: number;
  folderTitle?: string;
  folderUid?: string;
  folderUrl?: string;
  id: number;
  isStarred: boolean;
  selected?: boolean;
  tags: string[];
  title: string;
  type: DashboardSearchItemType;
  uid?: string;
  uri: string;
  url: string;
}

export interface DashboardSearchHit extends DashboardSectionItem, DashboardSection {}

export interface DashboardTag {
  term: string;
  count: number;
}

export interface SearchAction extends Action {
  payload?: any;
}

export interface UidsToDelete {
  folders: string[];
  dashboards: string[];
}

export interface DashboardQuery {
  query: string;
  tag: string[];
  starred: boolean;
  skipRecent: boolean;
  skipStarred: boolean;
  folderIds: number[];
  sort: SelectableValue | null;
  layout: SearchLayout;
}

export type SearchReducer<S> = [S, Dispatch<SearchAction>];
interface UseSearchParams {
  queryParsing?: boolean;
  searchCallback?: (folderUid: string | undefined) => any;
  folderUid?: string;
}

export type UseSearch = <S>(
  query: DashboardQuery,
  reducer: SearchReducer<S>,
  params: UseSearchParams
) => { state: S; dispatch: Dispatch<SearchAction>; onToggleSection: (section: DashboardSection) => void };

export type OnToggleChecked = (item: DashboardSectionItem | DashboardSection) => void;
export type OnDeleteItems = (folders: string[], dashboards: string[]) => void;
export type OnMoveItems = (selectedDashboards: DashboardSectionItem[], folder: FolderInfo | null) => void;

export enum SearchLayout {
  List = 'list',
  Folders = 'folders',
}

export interface RouteParams {
  query?: string | null;
  sort?: string | null;
  starred?: boolean | null;
  tag?: string[] | null;
  layout?: SearchLayout | null;
}
