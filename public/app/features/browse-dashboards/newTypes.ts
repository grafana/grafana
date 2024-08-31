import { FolderSearchHit } from './new-api';

export type OpenFolders = Record<string, boolean>;

export interface NewBrowseItemDashboard {
  type: 'dashboard';
  title: string;
  uid: string;
  parentUid?: string;
  level: number;
}

export interface NewBrowseItemFolder {
  type: 'folder';
  uid: string;
  isOpen: boolean;
  parentUid?: string;
  level: number;
  item: FolderSearchHit;
}

export interface NewBrowseItemLoadingPlaceholder {
  type: 'loading-placeholder';
  uid: string;
  parentUid?: string;
  level: number;
}

export type NewBrowseItem = NewBrowseItemDashboard | NewBrowseItemFolder | NewBrowseItemLoadingPlaceholder;
