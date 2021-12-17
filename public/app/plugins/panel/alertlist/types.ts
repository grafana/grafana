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

interface StateFilter {
  firing: boolean;
  pending: boolean;
  inactive: boolean;
  noData: boolean;
  normal: boolean;
  error: boolean;
}

export interface UnifiedAlertListOptions {
  maxItems: number;
  sortOrder: SortOrder;
  dashboardAlerts: boolean;
  alertName: string;
  showInstances: boolean;
  folder: { id: number; title: string };
  stateFilter: StateFilter;
  alertInstanceLabelFilter: string;
  datasource: string;
}
