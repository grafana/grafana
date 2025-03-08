import { UrlQueryMap } from '@grafana/data';
import { Resource } from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { AnnotationsPermissions, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

export interface DashboardAPI<G, T> {
  /** Get a dashboard with the access control metadata */
  getDashboardDTO(uid: string, params?: UrlQueryMap): Promise<G>;
  /** Save dashboard */
  saveDashboard(options: SaveDashboardCommand<T>): Promise<SaveDashboardResponseDTO>;
  /** Delete a dashboard */
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
}

export interface DashboardStatus {
  /**
   * When querying a dashboard that was stored in a different version than the current apiVersion,
   * it will return conversion errors because conversions in the backend are not implemented yet
   * @example If we query a dashboard that was stored in v2alpha1, from alhpaV1:
   * {
   *   "status": {
   *     "conversion": {
   *       "error": "conversion not implemented yet",
   *       "failed": true,
   *       "storedVersion": "v2alpha1"
   *     }
   *   }
   * }
   */
  conversion?: {
    error: string;
    failed: boolean;
    storedVersion: DashboardStoredVersion;
  };
}

// Implemented using /api/dashboards/*
export interface DashboardWithAccessInfo<T> extends Resource<T, DashboardStatus, 'DashboardWithAccessInfo'> {
  access: {
    url?: string;
    slug?: string;
    canSave?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canStar?: boolean;
    canAdmin?: boolean;
    annotationsPermissions?: AnnotationsPermissions;
  }; // TODO...
}

export type DashboardStoredVersion = 'v2alpha1' | 'v1alpha1' | 'v0alpha1';

export interface DashboardVersionError extends Error {
  status: number;
  data: {
    storedVersion: DashboardStoredVersion;
    message: string;
  };
}

export class DashboardVersionError extends Error {
  constructor(storedVersion: DashboardStoredVersion, message = 'Dashboard version mismatch') {
    super(message);
    this.name = 'DashboardVersionError';
    this.status = 200;
    this.data = {
      storedVersion,
      message,
    };
  }
}
