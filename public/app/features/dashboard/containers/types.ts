export interface DashboardPageRouteParams {
  uid?: string;
  type?: string;
  slug?: string;
  accessToken?: string;
}

export type DashboardPageRouteSearchParams = {
  tab?: string;
  folderUid?: string;
  editPanel?: string;
  viewPanel?: string;
  editview?: string;
  addWidget?: boolean;
  panelType?: string;
  inspect?: string;
  from?: string;
  to?: string;
  refresh?: string;
  kiosk?: string | true;
  scenes?: boolean;
  shareView?: string;
  ref?: string; // used for repo preview
};

export type PublicDashboardPageRouteParams = {
  accessToken?: string;
};

export type PublicDashboardPageRouteSearchParams = {
  from?: string;
  to?: string;
  refresh?: string;
  scenes?: boolean;
};
