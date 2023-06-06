//DOCS: https://prometheus.io/docs/alerting/latest/configuration/

import { DataSourceJsonData } from '@grafana/data';

export type AlertManagerCortexConfig = {
  template_files: Record<string, string>;
  alertmanager_config: AlertmanagerConfig;
  /** { [name]: provenance } */
  template_file_provenances?: Record<string, string>;
  last_applied?: string;
  id?: number;
};

export type TLSConfig = {
  ca_file: string;
  cert_file: string;
  key_file: string;
  server_name?: string;
  insecure_skip_verify?: boolean;
};

export type HTTPConfigCommon = {
  proxy_url?: string;
  tls_config?: TLSConfig;
};

export type HTTPConfigBasicAuth = {
  basic_auth: {
    username: string;
  } & ({ password: string } | { password_file: string });
};

export type HTTPConfigBearerToken = {
  bearer_token: string;
};

export type HTTPConfigBearerTokenFile = {
  bearer_token_file: string;
};

export type HTTPConfig = HTTPConfigCommon & (HTTPConfigBasicAuth | HTTPConfigBearerToken | HTTPConfigBearerTokenFile);

export type EmailConfig = {
  to: string;

  send_resolved?: string;
  from?: string;
  smarthost?: string;
  hello?: string;
  auth_username?: string;
  auth_password?: string;
  auth_secret?: string;
  auth_identity?: string;
  require_tls?: boolean;
  tls_config?: TLSConfig;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
};

export type WebhookConfig = {
  url: string;

  send_resolved?: boolean;
  http_config?: HTTPConfig;
  max_alerts?: number;
};

export type GrafanaManagedReceiverConfig = {
  uid?: string;
  disableResolveMessage: boolean;
  secureFields?: Record<string, boolean>;
  secureSettings?: Record<string, any>;
  settings: Record<string, any>;
  type: string;
  name: string;
  updated?: string;
  created?: string;
  provenance?: string;
};

export type Receiver = {
  name: string;

  email_configs?: EmailConfig[];
  pagerduty_configs?: any[];
  pushover_configs?: any[];
  slack_configs?: any[];
  opsgenie_configs?: any[];
  webhook_configs?: WebhookConfig[];
  victorops_configs?: any[];
  wechat_configs?: any[];
  grafana_managed_receiver_configs?: GrafanaManagedReceiverConfig[];
  [key: string]: any;
};

export type ObjectMatcher = [name: string, operator: MatcherOperator, value: string];

export type Route = {
  receiver?: string;
  group_by?: string[];
  continue?: boolean;
  object_matchers?: ObjectMatcher[];
  matchers?: string[];
  /** @deprecated use `object_matchers` */
  match?: Record<string, string>;
  /** @deprecated use `object_matchers` */
  match_re?: Record<string, string>;
  group_wait?: string;
  group_interval?: string;
  repeat_interval?: string;
  routes?: Route[];
  mute_time_intervals?: string[];
  /** only the root policy might have a provenance field defined */
  provenance?: string;
};

export interface RouteWithID extends Route {
  id: string;
  routes?: RouteWithID[];
}

export type InhibitRule = {
  target_match: Record<string, string>;
  target_match_re: Record<string, string>;
  source_match: Record<string, string>;
  source_match_re: Record<string, string>;
  equal?: string[];
};

export type AlertmanagerConfig = {
  global?: {
    smtp_from?: string;
    smtp_smarthost?: string;
    smtp_hello?: string;
    smtp_auth_username?: string;
    smtp_auth_password?: string;
    smtp_auth_identity?: string;
    smtp_auth_secret?: string;
    smtp_require_tls?: boolean;
    slack_api_url?: string;
    victorops_api_key?: string;
    victorops_api_url?: string;
    pagerduty_url?: string;
    opsgenie_api_key?: string;
    opsgenie_api_url?: string;
    wechat_api_url?: string;
    wechat_api_secret?: string;
    wechat_api_corp_id?: string;
    http_config?: HTTPConfig;
    resolve_timeout?: string;
  };
  templates?: string[];
  route?: Route;
  inhibit_rules?: InhibitRule[];
  receivers?: Receiver[];
  mute_time_intervals?: MuteTimeInterval[];
  /** { [name]: provenance } */
  muteTimeProvenances?: Record<string, string>;
  last_applied?: boolean;
};

export type Matcher = {
  name: string;
  value: string;
  isRegex: boolean;
  isEqual: boolean;
};

export enum SilenceState {
  Active = 'active',
  Expired = 'expired',
  Pending = 'pending',
}

export enum AlertState {
  Unprocessed = 'unprocessed',
  Active = 'active',
  Suppressed = 'suppressed',
}

export enum MatcherOperator {
  equal = '=',
  notEqual = '!=',
  regex = '=~',
  notRegex = '!~',
}

export type Silence = {
  id: string;
  matchers?: Matcher[];
  startsAt: string;
  endsAt: string;
  updatedAt: string;
  createdBy: string;
  comment: string;
  status: {
    state: SilenceState;
  };
};

export type SilenceCreatePayload = {
  id?: string;
  matchers?: Matcher[];
  startsAt: string;
  endsAt: string;
  createdBy: string;
  comment: string;
};

export type AlertmanagerAlert = {
  startsAt: string;
  updatedAt: string;
  endsAt: string;
  generatorURL?: string;
  labels: { [key: string]: string };
  annotations: { [key: string]: string };
  receivers: [
    {
      name: string;
    }
  ];
  fingerprint: string;
  status: {
    state: AlertState;
    silencedBy: string[];
    inhibitedBy: string[];
  };
};

export type AlertmanagerGroup = {
  labels: { [key: string]: string };
  receiver: { name: string };
  alerts: AlertmanagerAlert[];
};

export interface AlertmanagerStatus {
  cluster: {
    peers: unknown;
    status: string;
  };
  config: AlertmanagerConfig;
  uptime: string;
  versionInfo: {
    branch: string;
    buildDate: string;
    buildUser: string;
    goVersion: string;
    revision: string;
    version: string;
  };
}

export type TestReceiversAlert = Pick<AlertmanagerAlert, 'annotations' | 'labels'>;
export type TestTemplateAlert = Pick<AlertmanagerAlert, 'annotations' | 'labels' | 'startsAt' | 'endsAt'>;

export interface TestReceiversPayload {
  receivers?: Receiver[];
  alert?: TestReceiversAlert;
}

interface TestReceiversResultGrafanaReceiverConfig {
  name: string;
  uid?: string;
  error?: string;
  status: 'ok' | 'failed';
}

interface TestReceiversResultReceiver {
  name: string;
  grafana_managed_receiver_configs: TestReceiversResultGrafanaReceiverConfig[];
}
export interface TestReceiversResult {
  notified_at: string;
  receivers: TestReceiversResultReceiver[];
}

export interface ExternalAlertmanagers {
  activeAlertManagers: AlertmanagerUrl[];
  droppedAlertManagers: AlertmanagerUrl[];
}

export interface AlertmanagerUrl {
  url: string;
}

export interface ExternalAlertmanagersResponse {
  data: ExternalAlertmanagers;
}

export enum AlertmanagerChoice {
  Internal = 'internal',
  External = 'external',
  All = 'all',
}

export interface ExternalAlertmanagerConfig {
  alertmanagersChoice: AlertmanagerChoice;
}

export enum AlertManagerImplementation {
  cortex = 'cortex',
  mimir = 'mimir',
  prometheus = 'prometheus',
}

export interface TimeRange {
  /** Times are in format `HH:MM` in UTC */
  start_time: string;
  end_time: string;
}
export interface TimeInterval {
  times?: TimeRange[];
  weekdays?: string[];
  days_of_month?: string[];
  months?: string[];
  years?: string[];
  /** IANA TZ identifier like "Europe/Brussels", also supports "Local" or "UTC" */
  location?: string;
}

export type MuteTimeInterval = {
  name: string;
  time_intervals: TimeInterval[];
  provenance?: string;
};

export interface AlertManagerDataSourceJsonData extends DataSourceJsonData {
  implementation?: AlertManagerImplementation;
  handleGrafanaManagedAlerts?: boolean;
}
