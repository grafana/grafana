import { Dispatch } from 'react';
import { Action } from 'redux';
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
  icon: string;
  score: number;
  hideHeader?: boolean;
  checked?: boolean;
  items: DashboardSectionItem[];
  toggle?: (section: DashboardSection) => Promise<DashboardSection>;
  selected?: boolean;
  type: DashboardSearchItemType;
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
  uid: string;
  uri: string;
  url: string;
}

export interface DashboardTag {
  term: string;
  count: number;
}

export interface SectionsState {
  sections: DashboardSection[];
  allChecked: boolean;
  dashboardTags: DashboardTag[];
}

export type ItemClickWithEvent = (item: DashboardSectionItem | DashboardSection, event: any) => void;

export interface SearchAction extends Action {
  payload?: any;
}

export interface OpenSearchParams {
  query?: string;
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
}

export type SearchReducer<S> = [S, Dispatch<SearchAction>];

export type UseSearch = <S>(
  query: DashboardQuery,
  reducer: SearchReducer<S>,
  queryParsing?: boolean
) => { state: S; dispatch: Dispatch<SearchAction>; onToggleSection: (section: DashboardSection) => void };

export type OnToggleChecked = (item: DashboardSectionItem | DashboardSection) => void;
export type OnDeleteItems = (folders: string[], dashboards: string[]) => void;
export type OnMoveItems = (selectedDashboards: DashboardSectionItem[], folder: FolderInfo | null) => void;
