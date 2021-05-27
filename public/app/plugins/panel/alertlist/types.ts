import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

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

export interface UnifiedAlertlistOptions {
  maxItems: number;
  sortOrder: SortOrder;
  dashboardAlerts: boolean;
  alertName: string;
  showInstances: boolean;
  stateFilter: {
    [K in PromAlertingRuleState]: boolean;
  };
}
