import { PaginatedPayload, PrioritizedLabels, Severity } from '../shared/core/types';

export interface CheckResultSummary {
  service_name: string;
  service_id: string;
  // Number of failed checks for this service with severity level "EMERGENCY".
  emergency_count: string;
  // Number of failed checks for this service with severity level "ALERT".
  alert_count: string;
  // Number of failed checks for this service with severity level "CRITICAL".
  critical_count: string;
  // Number of failed checks for this service with severity level "ERROR".
  error_count: string;
  // Number of failed checks for this service with severity level "WARNING".
  warning_count: string;
  // Number of failed checks for this service with severity level "NOTICE".
  notice_count: string;
  // Number of failed checks for this service with severity level "INFO".
  info_count: string;
  // Number of failed checks for this service with severity level "DEBUG".
  debug_count: string;
}

export interface CheckResultSummaryPayload extends PaginatedPayload {
  result: CheckResultSummary[];
}

export interface FailedChecksCounts {
  emergency: number;
  alert: number;
  critical: number;
  error: number;
  warning: number;
  notice: number;
  info: number;
  debug: number;
}

export interface FailedCheckSummary {
  serviceName: string;
  serviceId: string;
  counts: FailedChecksCounts;
}

interface CheckResultForService {
  summary: string;
  description: string;
  severity: keyof typeof Severity;
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
  severity: Severity;
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
  ADVISOR_CHECK_INTERVAL_STANDARD = 'Standard',
  ADVISOR_CHECK_INTERVAL_RARE = 'Rare',
  ADVISOR_CHECK_INTERVAL_FREQUENT = 'Frequent',
  ADVISOR_CHECK_INTERVAL_UNSPECIFIED = 'Unspecified',
}

export interface CheckDetails {
  name: string;
  summary: string;
  interval: keyof typeof Interval;
  category: string;
  family: string;
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

export interface AlertsReload {
  fetchAlerts: () => Promise<void>;
}
