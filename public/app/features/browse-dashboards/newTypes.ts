export type OpenFolders = Record<string, boolean>;

export interface NewBrowseItemDashboard {
  type: 'dashboard';
  title: string;
  uid: string;
  parentUid?: string;
}

export interface NewBrowseItemFolder {
  type: 'folder';
  title: string;
  uid: string;
  parentUid?: string;
}

export interface NewBrowseItemLoadingPlaceholder {
  type: 'loading-placeholder';
  uid: string;
  parentUid?: string;
}

export type NewBrowseItem = NewBrowseItemDashboard | NewBrowseItemFolder | NewBrowseItemLoadingPlaceholder;
