import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export interface StateFilter {
  firing: boolean;
  pending: boolean;
}

export interface AlertListPanelOptions {
  datasource: string[];
  stateFilter: StateFilter;
  alertInstanceLabelFilter?: string;
  folder?: { uid: string; title: string } | null;
}

// Unified alert item types for virtualization
export interface GrafanaAlertItem {
  type: 'grafana';
  key: string;
  name: string;
  href: string;
  state: PromAlertingRuleState;
  namespace: string;
  itemHeight: number;
}

export interface ExternalAlertItem {
  type: 'external';
  key: string;
  name: string;
  href: string;
  state: PromAlertingRuleState;
  itemHeight: number;
}

export type UnifiedAlertItem = GrafanaAlertItem | ExternalAlertItem;
