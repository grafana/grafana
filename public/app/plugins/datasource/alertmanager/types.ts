//DOCS: https://prometheus.io/docs/alerting/latest/configuration/
import { DataSourceJsonData, WithAccessControlMetadata } from '@grafana/data';
import { IoK8SApimachineryPkgApisMetaV1ObjectMeta } from 'app/features/alerting/unified/openapi/receiversApi.gen';

export type AlertManagerCortexConfig = {
  template_files: Record<string, string>;
  alertmanager_config: AlertmanagerConfig;
  /** { [name]: provenance } */
  template_file_provenances?: Record<string, string>;
  last_applied?: string;
  id?: number;
};

export type TLSConfig = {
  ca_file?: string;
  cert_file?: string;
  key_file?: string;
  server_name?: string;
  insecure_skip_verify?: boolean;
};

export type HTTPConfigCommon = {
  proxy_url?: string | null;
  tls_config?: TLSConfig;
};

export type HTTPConfigBasicAuth = {
  basic_auth?: {
    username: string;
  } & ({ password?: string } | { password_file?: string });
};

export type HTTPConfigBearerToken = {
  bearer_token?: string;
};

export type HTTPConfigBearerTokenFile = {
  bearer_token_file?: string;
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

type GrafanaManagedReceiverConfigSettings<T = any> = Record<string, T>;
export type GrafanaManagedReceiverConfig = {
  uid?: string;
  disableResolveMessage?: boolean;
  secureFields?: Record<string, boolean>;
  secureSettings?: GrafanaManagedReceiverConfigSettings;
  /** If retrieved from k8s API, SecureSettings property name is different */
  // SecureSettings?: GrafanaManagedReceiverConfigSettings<boolean>;
  settings: GrafanaManagedReceiverConfigSettings;
  type: string;
  /**
   * Name of the _receiver_, which in most cases will be the
   * same as the contact point's name. This should not be used, and is optional because the
   * kubernetes API does not return it for us (and we don't want to/shouldn't use it)
   *
   * @deprecated Do not rely on this property - it won't be present in kuberenetes API responses
   * and should be the same as the contact point name anyway
   */
  name?: string;
  updated?: string;
  created?: string;
  provenance?: string;
};

export interface GrafanaManagedContactPoint {
  name: string;
  /** If parsed from k8s API, we'll have an ID property */
  id?: string;
  metadata?: IoK8SApimachineryPkgApisMetaV1ObjectMeta;
  provisioned?: boolean;
  grafana_managed_receiver_configs?: GrafanaManagedReceiverConfig[];
}

export interface AlertmanagerReceiver {
  name: string;

  email_configs?: EmailConfig[];
  webhook_configs?: WebhookConfig[];

  // this is supposedly to support any *_configs
  [key: `${string}_configs`]: any[] | undefined;
}

export type Receiver = GrafanaManagedContactPoint | AlertmanagerReceiver;

export type ObjectMatcher = [name: string, operator: MatcherOperator, value: string];

export type Route = {
  receiver?: string | null;
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
  /** Times when the route should be muted. */
  mute_time_intervals?: string[];
  /** Times when the route should be active. This is the opposite of `mute_time_intervals` */
  active_time_intervals?: string[];
  /** only the root policy might have a provenance field defined */
  provenance?: string;
  _metadata?: {
    provisioned?: boolean;
    resourceVersion?: string;
    name?: string;
  };
};

export interface RouteWithID extends Route {
  id: string;
  routes?: RouteWithID[];
}

export type InhibitRule = {
  target_match?: Record<string, string>;
  target_match_re?: Record<string, string>;
  source_match?: Record<string, string>;
  source_match_re?: Record<string, string>;
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
  time_intervals?: MuteTimeInterval[];
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

export interface Silence extends WithAccessControlMetadata {
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
  metadata?: {
    rule_uid?: string;
    rule_title?: string;
    folder_uid?: string;
  };
}

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
  receivers: Array<{ name: string }>;
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
export type TestTemplateAlert = Pick<
  AlertmanagerAlert,
  'annotations' | 'labels' | 'startsAt' | 'endsAt' | 'generatorURL' | 'fingerprint'
> & {
  status: 'firing' | 'resolved';
};

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

export interface ExternalAlertmanagersConnectionStatus {
  activeAlertManagers: AlertmanagerUrl[];
  droppedAlertManagers: AlertmanagerUrl[];
}

export interface AlertmanagerUrl {
  url: string;
}

export interface ExternalAlertmanagersStatusResponse {
  data: ExternalAlertmanagersConnectionStatus;
}

export enum AlertmanagerChoice {
  Internal = 'internal',
  External = 'external',
  All = 'all',
}

export interface GrafanaAlertingConfiguration {
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
  provisioned?: boolean;
};

export interface AlertManagerDataSourceJsonData extends DataSourceJsonData {
  implementation?: AlertManagerImplementation;
  handleGrafanaManagedAlerts?: boolean;
}
