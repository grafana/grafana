import { UrlQueryMap } from '@grafana/data';
import { ObjectMeta, Resource } from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { AnnotationsPermissions, DashboardMeta, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

export interface DashboardAPI<G> {
  /** Get a dashboard with the access control metadata */
  getDashboardDTO(uid: string, params?: UrlQueryMap): Promise<DashboardWithAccessInfo<G>>;
  /** Save dashboard */
  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO>;
  /** Delete a dashboard */
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
}

// Implemented using /api/dashboards/*
export interface DashboardWithAccessInfo<T> extends Resource<T, 'DashboardWithAccessInfo'> {
  metadata: ObjectMeta & {
    _legacyMetadata?: DashboardMeta
  };
  access: {
    url?: string;
    slug?: string;
    canSave?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canShare?: boolean;
    canStar?: boolean;
    canAdmin?: boolean;
    canMakeEditable?: boolean;
    annotationsPermissions?: AnnotationsPermissions;
    isNew?: boolean;
  }; // TODO...
}
