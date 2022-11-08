import { WithAccessControlMetadata } from '@grafana/data';

import { DashboardAcl } from './acl';

export interface FolderDTO extends WithAccessControlMetadata {
  id: number;
  uid: string;
  title: string;
  url: string;
  version: number;
  canSave: boolean;
  canEdit: boolean;
  canAdmin: boolean;
  canDelete: boolean;
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

export interface FolderInfo {
  /**
   * @deprecated use uid instead.
   */
  id?: number;
  uid?: string;
  title?: string;
  url?: string;
  canViewFolderPermissions?: boolean;
}
