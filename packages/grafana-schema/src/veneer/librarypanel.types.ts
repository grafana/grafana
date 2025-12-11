import { Panel } from './dashboard.types';

export interface LibraryElementDTOMetaUser {
  avatarUrl: string;
  id: number;
  name: string;
}

export interface LibraryElementDTOMeta {
  connectedDashboards: number;
  created: string;
  createdBy: LibraryElementDTOMetaUser;
  folderName: string;
  folderUid: string;
  updated: string;
  updatedBy: LibraryElementDTOMetaUser;
}

export interface LibraryPanel {
  /**
   * Panel description
   */
  description?: string;
  /**
   * Folder UID
   */
  folderUid?: string;
  /**
   * Object storage metadata
   */
  meta?: LibraryElementDTOMeta;

  // The panel
  model: Omit<Panel, 'gridPos' | 'id' | 'libraryPanel'>;
  /**
   * Panel name (also saved in the model)
   */
  name: string;
  /**
   * Dashboard version when this was saved (zero if unknown)
   */
  schemaVersion?: number;
  /**
   * The panel type (from inside the model)
   */
  type: string;
  /**
   * Library element UID
   */
  uid: string;
  /**
   * panel version, incremented each time the dashboard is updated.
   */
  version: number;
}
