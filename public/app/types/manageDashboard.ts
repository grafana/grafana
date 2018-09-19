export interface ManageDashboard {
  selectAllChecked: boolean;

  // enable/disable actions depending on the folders or dashboards selected
  canDelete: boolean;
  canMove: boolean;

  // filter variables
  hasFilters: boolean;
  selectedTagFilter: any;
  filterOnStarred: boolean;

  // used when managing dashboards for a specific folder
  folderId?: number;
  folderUid?: string;

  // if user can add new folders and/or add new dashboards
  canSave: boolean;

  // if user has editor role or higher
  isEditor: boolean;

  hasEditPermissionInFolders: boolean;
}

export interface DashboardSection {
  id: number;
  uid: string;
  title: string;
  expanded: boolean;
  url: string;
  icon: string;
  score: number;
  hideHeader: boolean;
  checked: boolean;
  items: DashboardSectionItem[];
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
  folderId: number;
  folderUid: string;
  folderTitle: string;
  folderUrl: string;
  checked: boolean;
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

export interface ManageDashboardState {
  manageDashboard: ManageDashboard;
  dashboardQuery: DashboardQuery;
}
