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

export interface DashboardQuery {
  query: string;
  mode: string;
  tag: string[];
  starred: boolean;
  skipRecent: boolean;
  skipStarred: boolean;
  folderIds: number[];
}

export interface SectionsState {
  sections: DashboardSection[];
  allChecked: boolean;
  dashboardTags: DashboardTag[];
}

export type ItemClickWithEvent = (item: DashboardSectionItem | DashboardSection, event: any) => void;

export type SearchAction = {
  type: string;
  payload?: any;
};
