export interface Snapshot {
  created: string;
  expires: string;
  external: boolean;
  externalUrl: string;
  id: number;
  key: string;
  name: string;
  orgId: number;
  updated: string;
  url?: string;
  userId: number;
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
