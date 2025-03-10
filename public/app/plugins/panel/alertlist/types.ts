export enum SortOrder {
  AlphaAsc = 1,
  AlphaDesc,
  Importance,
  TimeAsc,
  TimeDesc,
}

export enum GroupMode {
  Default = 'default',
  Custom = 'custom',
}

export enum ViewMode {
  List = 'list',
  Stat = 'stat',
}

export interface StateFilter {
  firing: boolean;
  pending: boolean;
  inactive?: boolean; // backwards compat
  noData: boolean;
  normal: boolean;
  error: boolean;
}

export interface UnifiedAlertListOptions {
  maxItems: number;
  sortOrder: SortOrder;
  dashboardAlerts: boolean;
  groupMode: GroupMode;
  groupBy: string[];
  alertName: string;
  showInstances: boolean;
  folder: { id: number; title: string };
  stateFilter: StateFilter;
  alertInstanceLabelFilter: string;
  datasource: string;
  viewMode: ViewMode;
  showInactiveAlerts: boolean;
}
