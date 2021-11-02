import { SelectableValue } from '@grafana/data';

export interface NotificationChannelContext {
  getNotificationChannels: () => void;
  setSelectedNotificationChannel: (notificationChannel: NotificationChannel) => void;
  setAddModalVisible: (isVisible: boolean) => void;
  setDeleteModalVisible: (isVisible: boolean) => void;
}

export enum NotificationChannelType {
  email = 'email',
  pagerDuty = 'pagerDuty',
  slack = 'slack',
  webhook = 'webhook',
}

export enum PagerDutyKeyType {
  service = 'service',
  routing = 'routing',
}

export enum WebHookAuthType {
  basic = 'basic',
  token = 'token',
  none = 'none',
}

export interface NotificationChannel {
  type: NotificationChannelType;
  channelId?: string;
  summary: string;
  disabled?: boolean;
}

export interface EmailNotificationChannel extends NotificationChannel {
  sendResolved?: boolean;
  emails?: string[];
}

export interface PagerDutylNotificationChannel extends NotificationChannel {
  sendResolved?: boolean;
  routingKey?: string;
  serviceKey?: string;
}

export interface SlackNotificationChannel extends NotificationChannel {
  sendResolved?: boolean;
  channel?: string;
}

export interface WebHookNotificationChannel extends NotificationChannel {
  sendResolved?: boolean;
  url: string;
  username?: string;
  password?: string;
  token?: string;
  ca?: string;
  cert?: string;
  key?: string;
  serverName?: string;
  skipVerify?: boolean;
  maxAlerts?: number;
}

export interface NotificationChannelTotals {
  total_items: number;
  total_pages: number;
}

export interface NotificationChannelGetPayload {
  page_params: {
    page_size: number;
    index: number;
  };
}

export interface NotificationChannelList {
  channels: NotificationChannel[];
  totals: NotificationChannelTotals;
}

export interface NotificationChannelListResponse {
  channels: NotificationChannelAPI[];
  totals: NotificationChannelTotals;
}

export interface WebHookBasicAuthConfigAPI {
  username?: string;
  password?: string;
}

export interface WebHookTLSConfigAPI {
  ca_file_content: string;
  cert_file_content: string;
  key_file_content: string;
  server_name: string;
  insecure_skip_verify: boolean;
}
export interface WebHookHttpConfigAPI {
  basic_auth?: WebHookBasicAuthConfigAPI;
  bearer_token?: string;
  tls_config?: WebHookTLSConfigAPI;
  proxy_url?: string;
}

export interface NotificationChannelAPI {
  channel_id?: string;
  disabled?: boolean;
  summary: string;
  email_config?: EmailNotificationChannelAPI;
  pagerduty_config?: PagerDutyNotificationChannelAPI;
  slack_config?: SlackNotificationChannelAPI;
  webhook_config?: WebHookNotificationChannelAPI;
}

export interface EmailNotificationChannelAPI {
  send_resolved?: boolean;
  to?: string[];
}

export interface PagerDutyNotificationChannelAPI {
  send_resolved?: boolean;
  routing_key?: string;
  service_key?: string;
}

export interface SlackNotificationChannelAPI {
  send_resolved?: boolean;
  channel?: string;
}

export interface WebHookNotificationChannelAPI {
  send_resolved?: boolean;
  url?: string;
  http_config: WebHookHttpConfigAPI;
  max_alerts?: number;
}

export interface NotificationChannelRenderProps {
  name: string;
  type?: SelectableValue<NotificationChannelType>;
  emails?: string;
  keyType?: PagerDutyKeyType;
  routing?: string;
  service?: string;
  channel?: string;
  webHookType?: WebHookAuthType;
  useWebhookTls?: boolean;
  url?: string;
  username?: string;
  password?: string;
  token?: string;
  ca?: string;
  cert?: string;
  key?: string;
  serverName?: string;
  skipVerify?: boolean;
  maxAlerts?: number;
  sendResolved?: boolean;
}
