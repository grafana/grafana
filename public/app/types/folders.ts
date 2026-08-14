import { type WithAccessControlMetadata } from '@grafana/data';

import { type ManagerKind } from '../features/apiserver/types';

export interface FolderListItemDTO {
  uid: string;
  title: string;
  managedBy?: ManagerKind;
  parentUid?: string;
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

/**
 * API response from `/api/folders/${folderUID}/counts`
 * Supports both the current resource-style keys and older legacy aliases, which depends on whether the unified storage
 * is used or not. Also, the API does not exactly guarantee the shape or keys as it does it dynamically based on
 * existing resource types.
 */
export interface DescendantCountDTO {
  folders?: number;
  dashboards?: number;
  alertrules?: number;
  // There is this weird thing where legacy/sql-fallback values have different resource name for the panels. As the old
  // API uses the same backend as new and just reshapes it, this will leak here.
  library_elements?: number;
  librarypanels?: number;

  // Legacy keys that should not be actually returned anymore when unified storage is enabled but we keep it for now.
  folder?: number;
  dashboard?: number;
  alertrule?: number;
  librarypanel?: number;
}

type DescendantResource = 'folders' | 'dashboards' | 'librarypanels' | 'alertrules';
/** Summary of descendant counts by resource type, with keys matching the App Platform API response */
export interface DescendantCount extends Record<DescendantResource, number> {}
