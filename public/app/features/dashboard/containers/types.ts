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
  hideLogo?: string | true;
  shareView?: string;
  ref?: string; // used for repo preview
  // Used by template dashboards to identify the specific dashboard file
  path?: string;
  // Used by community template dashboards to identify the Grafana.com dashboard
  gnetId?: string;
  // Used by the org dashboard templates flow on DashboardRoutes.Template.
  dashboardTemplateUid?: string;
  editTemplate?: string | true;
  // UID of an existing dashboard to clone from on DashboardRoutes.NewFromExisting.
  sourceUid?: string;
};

export type PublicDashboardPageRouteParams = {
  accessToken?: string;
};

export type PublicDashboardPageRouteSearchParams = {
  from?: string;
  to?: string;
  refresh?: string;
};
