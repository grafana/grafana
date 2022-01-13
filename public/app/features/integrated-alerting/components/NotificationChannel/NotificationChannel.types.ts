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

export interface NotificationChannel {
  type: NotificationChannelType;
  channelId: string;
  summary: string;
  disabled: boolean;
}

export interface EmailNotificationChannel extends NotificationChannel {
  sendResolved: boolean;
  emails: string[];
}

export interface PagerDutylNotificationChannel extends NotificationChannel {
  sendResolved: boolean;
  routingKey: string;
  serviceKey: string;
}

export interface SlackNotificationChannel extends NotificationChannel {
  sendResolved: boolean;
  channel: string;
}

export interface NotificationChannelListResponse {
  channels: NotificationChannelAPI[];
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
  to: string[];
}

export interface PagerDutyNotificationChannelAPI {
  send_resolved?: boolean;
  routing_key: string;
  service_key: string;
}

export interface SlackNotificationChannelAPI {
  send_resolved?: boolean;
  channel: string;
}

export interface NotificationChannelRenderProps {
  name: string;
  type: SelectableValue<NotificationChannelType>;
  emails?: string;
  routing?: string;
  service?: string;
  channel?: string;
}
