import { FC } from 'react';
import { RouteComponentProps } from 'react-router-dom';

export interface CheckPanelOptions {
  title?: string;
}

export interface Column {
  title: string;
  dataIndex: string;
  key: string;
  render?: (text: any, record: Record<string, any>) => React.ReactNode;
  width?: number;
}

export enum Severity {
  error = 'error',
  warning = 'warning',
  notice = 'notice',
}

export type FailedChecks = [number, number, number];

export interface ActiveCheck {
  key: string;
  name: string;
  failed: FailedChecks;
  details: Array<{
    description: string;
    labels: { [key: string]: string };
    silenced: boolean;
    readMoreUrl?: string;
  }>;
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
  allChecks = 'allChecks',
  failedChecks = 'failedChecks',
  rootChecks = 'root-checks',
}

export interface TabEntry {
  label: string;
  key: TabKeys;
  component: React.ReactNode;
}

export type CheckPanelProps = { component: FC } & RouteComponentProps;

export type SeverityMap = Record<Severity, string>;

export interface Alert {
  annotations: {
    description: string;
    summary: string;
    read_more_url?: string;
  };
  labels: {
    stt_check?: string;
    service_name: string;
    severity: Severity;
  };
  status: {
    state: AlertState;
  };
}

export interface AlertRequestParams {
  active?: boolean;
  silenced?: boolean;
  filter?: string;
}

export interface Settings {
  settings: {
    stt_enabled?: boolean;
    telemetry_enabled?: boolean;
  };
}

interface SilenceMatcher {
  name: string;
  value: string;
  isRegex: boolean;
}

export interface SilenceBody {
  matchers: SilenceMatcher[];
  startsAt: string;
  endsAt: string;
  createdBy: string;
  comment: string;
  id: string;
}

export interface SilenceResponse {
  silenceID: string;
}

export type Labels = { [key: string]: string };

export interface DetailProps {
  details: {
    description: string;
    labels: Labels;
  };
}

export interface DetailsItem {
  description: string;
  labels: Labels;
  silenced: boolean;
  readMoreUrl?: string;
}

export interface TableDataAlertDetailsProps {
  detailsItem: DetailsItem;
}

export interface AlertsReload {
  fetchAlerts: () => Promise<void>;
}
