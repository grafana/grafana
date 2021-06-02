import {
  NotificationChannelAPI,
  NotificationChannelType,
  EmailNotificationChannel,
  PagerDutylNotificationChannel,
  SlackNotificationChannel,
  NotificationChannelContext,
} from '../NotificationChannel.types';

export const notificationChannelResponseStubs: NotificationChannelAPI[] = [
  {
    channel_id: '1',
    summary: 'email channel',
    disabled: false,
    email_config: {
      send_resolved: false,
      to: ['test1@gmail.com', 'test2@gmail.com'],
    },
  },
  {
    channel_id: '2',
    summary: 'pagerduty channel',
    disabled: true,
    pagerduty_config: {
      send_resolved: true,
      routing_key: 'abcd',
      service_key: 'abcd',
    },
  },
  {
    channel_id: '3',
    summary: 'slack channel',
    disabled: false,
    slack_config: {
      send_resolved: true,
      channel: 'pmm-dev',
    },
  },
];

export const notificationChannelStubs: Array<
  EmailNotificationChannel | PagerDutylNotificationChannel | SlackNotificationChannel
> = [
  {
    type: NotificationChannelType.email,
    channelId: '1',
    summary: 'email channel',
    disabled: false,
    sendResolved: false,
    emails: ['test1@gmail.com', 'test2@gmail.com'],
  },
  {
    type: NotificationChannelType.pagerDuty,
    channelId: '2',
    summary: 'pagerduty channel',
    disabled: true,
    sendResolved: true,
    routingKey: 'abcd',
    serviceKey: 'abcd',
  },
  {
    type: NotificationChannelType.slack,
    channelId: '3',
    summary: 'slack channel',
    disabled: false,
    sendResolved: true,
    channel: 'pmm-dev',
  },
];

export const notificationChannelContextStub: NotificationChannelContext = {
  setSelectedNotificationChannel: jest.fn(),
  setAddModalVisible: jest.fn(),
  getNotificationChannels: jest.fn(),
  setDeleteModalVisible: jest.fn(),
};
