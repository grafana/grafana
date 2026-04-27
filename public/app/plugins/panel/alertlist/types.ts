import { type ThresholdsConfig, ThresholdsMode, type ValueMapping } from '@grafana/data/types';
import { type BigValueColorMode } from '@grafana/ui';

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
  recovering: boolean;
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
  folder: { uid: string; title: string };
  stateFilter: StateFilter;
  alertInstanceLabelFilter: string;
  datasource: string;
  viewMode: ViewMode;
  showInactiveAlerts: boolean;
  statColorMode: BigValueColorMode;
  statThresholds: ThresholdsConfig;
  statValueMappings: ValueMapping[];
}

export const STAT_THRESHOLDS_DEFAULT: ThresholdsConfig = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 80, color: 'red' },
  ],
};
