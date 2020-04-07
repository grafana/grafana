import { DashboardAcl } from './acl';

export interface FolderDTO {
  id: number;
  uid: string;
  title: string;
  url: string;
  version: number;
  canSave: boolean;
}

export interface FolderState {
  id: number;
  uid: string;
  title: string;
  url: string;
  canSave: boolean;
  hasChanged: boolean;
  version: number;
  permissions: DashboardAcl[];
}

export interface FolderInfo {
  id: number;
  title: string;
  url: string;
}
