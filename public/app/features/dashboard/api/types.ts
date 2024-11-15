import { UrlQueryMap } from '@grafana/data';
import { Resource } from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO, DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

export interface DashboardAPI<T> {
  /** Get a dashboard with the access control metadata */
  getDashboardDTO(uid: string, params?: UrlQueryMap): Promise<DashboardDTO<DashboardDataDTO>>;
  /** Save dashboard */
  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO>;
  /** Delete a dashboard */
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
}

// Implemented using /api/dashboards/*
export interface DashboardWithAccessInfo<T> extends Resource<T, 'DashboardWithAccessInfo'> {
  access: Object; // TODO...
}
