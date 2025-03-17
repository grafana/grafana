import { UrlQueryMap } from '@grafana/data';
import { Status } from '@grafana/schema/src/schema/dashboard/v2alpha1/types.status.gen';
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

// Implemented using /api/dashboards/*
export interface DashboardWithAccessInfo<T> extends Resource<T, Status, 'DashboardWithAccessInfo'> {
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

export interface DashboardVersionError extends Error {
  status: number;
  data: {
    // The version which was stored when the dashboard was created / updated.
    // Currently known versions are: 'v2alpha1' | 'v1alpha1' | 'v0alpha1'
    storedVersion: string;
    message: string;
  };
}

export class DashboardVersionError extends Error {
  constructor(storedVersion: string, message = 'Dashboard version mismatch') {
    super(message);
    this.name = 'DashboardVersionError';
    this.status = 200;
    this.data = {
      storedVersion,
      message,
    };
  }
}
