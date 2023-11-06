import { Dashboard } from '@grafana/schema/src/veneer/dashboard.types';

import { ExternalDashboard } from '../dashboard/components/DashExportModal/DashboardExporter';

export interface Snapshot {
  created: string;
  expires: string;
  external: boolean;
  externalUrl: string;
  key: string;
  name: string;
  updated: string;
  url?: string;
}

export type DeleteDashboardResponse = {
  id: number;
  message: string;
  title: string;
};

export interface PublicDashboardListWithPaginationResponse {
  publicDashboards: PublicDashboardListResponse[];
  page: number;
  perPage: number;
  totalCount: number;
}

export interface PublicDashboardListResponse {
  uid: string;
  accessToken: string;
  dashboardUid: string;
  title: string;
  isEnabled: boolean;
}

export interface PublicDashboardListWithPagination extends PublicDashboardListWithPaginationResponse {
  totalPages: number;
}

export type DashboardJson = ExternalDashboard & Omit<Dashboard, 'panels'>;
