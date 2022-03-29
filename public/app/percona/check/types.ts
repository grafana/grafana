import { AlertRuleSeverity } from '../integrated-alerting/components/AlertRules/AlertRules.types';
import { PaginatedPayload, PrioritizedLabels } from '../shared/core/types';

interface CheckResultSummary {
  service_name: string;
  service_id: string;
  critical_count: number;
  warning_count: number;
  notice_count: number;
}

export interface CheckResultSummaryPayload extends PaginatedPayload {
  result: CheckResultSummary[];
}

export interface FailedCheckSummary {
  serviceName: string;
  serviceId: string;
  criticalCount: number;
  warningCount: number;
  noticeCount: number;
}

interface CheckResultForService {
  summary: string;
  description: string;
  severity: keyof typeof AlertRuleSeverity;
  labels: { [key: string]: string };
  read_more_url: string;
  service_name: string;
  check_name: string;
  silenced: boolean;
  alert_id: string;
}

export interface CheckResultForServicePayload extends PaginatedPayload {
  results: CheckResultForService[];
}

export interface ServiceFailedCheck {
  summary: string;
  description: string;
  severity: AlertRuleSeverity;
  labels: PrioritizedLabels;
  readMoreUrl: string;
  serviceName: string;
  checkName: string;
  silenced: boolean;
  alertId: string;
}

export enum AlertState {
  active = 'active',
  suppressed = 'suppressed',
  unprocessed = 'unprocessed',
}

export enum Interval {
  STANDARD = 'Standard',
  RARE = 'Rare',
  FREQUENT = 'Frequent',
}

export interface CheckDetails {
  name: string;
  summary: string;
  interval: keyof typeof Interval;
  description?: string;
  disabled?: boolean;
  readMoreUrl?: string;
}

export interface AllChecks {
  checks: CheckDetails[];
}

export interface ChangeCheckBody {
  params: Array<{
    name: string;
    enable?: boolean;
    interval?: keyof typeof Interval;
    disable?: boolean;
  }>;
}

export enum TabKeys {
  allChecks = 'all-checks',
  failedChecks = 'failed-checks',
  rootChecks = 'root-checks',
}

export interface AlertsReload {
  fetchAlerts: () => Promise<void>;
}
