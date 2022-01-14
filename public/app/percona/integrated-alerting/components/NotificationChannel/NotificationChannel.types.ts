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
}

export enum PagerDutyKeyType {
  service = 'service',
  routing = 'routing',
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

export interface NotificationChannelAPI {
  channel_id?: string;
  disabled?: boolean;
  summary: string;
  email_config?: EmailNotificationChannelAPI;
  pagerduty_config?: PagerDutyNotificationChannelAPI;
  slack_config?: SlackNotificationChannelAPI;
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

export interface NotificationChannelRenderProps {
  name: string;
  type?: SelectableValue<NotificationChannelType>;
  emails?: string;
  keyType?: PagerDutyKeyType;
  routing?: string;
  service?: string;
  channel?: string;
}
