export enum SortOrder {
  AlphaAsc = 1,
  AlphaDesc,
  Importance,
  TimeAsc,
  TimeDesc,
}

export enum ShowOption {
  Current = 'current',
  RecentChanges = 'changes',
}

export enum GroupMode {
  Default = 'default',
  Custom = 'custom',
}

export enum ViewMode {
  List = 'list',
  Stat = 'stat',
}

export interface AlertListOptions {
  showOptions: ShowOption;
  maxItems: number;
  sortOrder: SortOrder;
  dashboardAlerts: boolean;
  alertName: string;
  dashboardTitle: string;
  tags: string[];
  stateFilter: {
    ok: boolean;
    paused: boolean;
    no_data: boolean;
    execution_error: boolean;
    alerting: boolean;
    pending: boolean;
  };
  folderId: number;
}

export interface StateFilter {
  firing: boolean;
  pending: boolean;
  inactive?: boolean; // backwards compat
  normal: boolean;
  error: boolean;
  critical: boolean;
  warn: boolean;
  noData: boolean;
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
}
