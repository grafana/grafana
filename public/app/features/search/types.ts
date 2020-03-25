export interface DashboardSection {
  id: number;
  uid?: string;
  title: string;
  expanded: boolean;
  url: string;
  icon: string;
  score: number;
  hideHeader?: boolean;
  checked: boolean;
  items: DashboardSectionItem[];
  toggle?: (section: DashboardSection) => Promise<DashboardSection>;
  selected?: boolean;
}

export interface DashboardSectionItem {
  id: number;
  uid: string;
  title: string;
  uri: string;
  url: string;
  type: string;
  tags: string[];
  isStarred: boolean;
  folderId?: number;
  folderUid?: string;
  folderTitle?: string;
  folderUrl?: string;
  checked: boolean;
  selected?: boolean;
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
