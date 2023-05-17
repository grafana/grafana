import { WithAccessControlMetadata } from '@grafana/data';

import { DashboardAcl } from './acl';

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
  parents?: FolderDTO[];
  title: string;
  uid: string;
  updated: string;
  updatedBy: string;
  url: string;
  version?: number;
}

export interface FolderState {
  id: number;
  uid: string;
  title: string;
  url: string;
  canSave: boolean;
  canDelete: boolean;
  hasChanged: boolean;
  version: number;
  permissions: DashboardAcl[];
  canViewFolderPermissions: boolean;
}

export interface DescendantCountDTO {
  folder: number;
  dashboard: number;
  libraryPanel: number;
  alertrule?: number;
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
  canViewFolderPermissions?: boolean;
}
