import { type WithAccessControlMetadata } from '@grafana/data';

import { type ManagerKind } from '../features/apiserver/types';

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
  /** Identity of the managing system (`grafana.app/managerId`), e.g. the repository name. Only set by the app platform API. */
  managerId?: string;

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

type DescendantResource = 'folders' | 'dashboards' | 'librarypanels' | 'alertrules' | 'recordingrules' | 'variables';
/** Summary of descendant counts by resource type, with keys matching the App Platform API response */
export interface DescendantCount extends Record<DescendantResource, number> {}
