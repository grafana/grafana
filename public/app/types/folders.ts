import { WithAccessControlMetadata } from '@grafana/data';

import { ManagerKind } from '../features/apiserver/types';

export interface FolderListItemDTO {
  uid: string;
  title: string;
  managedBy?: ManagerKind;
}

export type FolderParent = Pick<FolderDTO, 'title' | 'uid' | 'url'>;

export interface FolderDTO extends WithAccessControlMetadata {
  canAdmin: boolean;
  canDelete: boolean;
  canEdit: boolean;
  canSave: boolean;
  created: string;
  createdBy: string;
  hasAcl: boolean;
  id: number;
  parentUid?: string;
  managedBy?: ManagerKind;

  // The API does actually return a full FolderDTO here, but we want to restrict it to just a few properties
  parents?: FolderParent[];
  title: string;
  uid: string;
  updated: string;
  updatedBy: string;
  url: string;
  version?: number;
}

/** Minimal data required to create a new folder */
export type NewFolder = Pick<FolderDTO, 'title' | 'parentUid'>;

export interface FolderState {
  id: number;
  uid: string;
  title: string;
  url: string;
  canSave: boolean;
  canDelete: boolean;
  hasChanged: boolean;
  version: number;
}

export interface DescendantCountDTO {
  folder: number;
  dashboard: number;
  librarypanel: number;
  alertrule: number;
}

export interface DescendantCount {
  folder: number;
  dashboard: number;
  libraryPanel: number;
  alertRule: number;
}

export interface FolderInfo {
  /**
   * @deprecated use uid instead.
   */
  id?: number; // can't be totally removed as search and alerts api aren't supporting folderUids yet. It will break DashList and AlertList panel
  uid?: string;
  title?: string;
  url?: string;
}
