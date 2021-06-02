import {
  NotificationChannel,
  NotificationChannelType,
  EmailNotificationChannel,
  NotificationChannelRenderProps,
  PagerDutylNotificationChannel,
  SlackNotificationChannel,
} from '../NotificationChannel.types';
import { TYPE_OPTIONS } from './AddNotificationChannel.constants';

export const INITIAL_VALUES = {
  [NotificationChannelType.email]: ({
    type,
    summary,
    emails,
  }: EmailNotificationChannel): NotificationChannelRenderProps => ({
    name: summary,
    type: getOptionFrom(type),
    emails: emails.join('\n'),
  }),
  [NotificationChannelType.pagerDuty]: ({
    type,
    summary,
    routingKey,
    serviceKey,
  }: PagerDutylNotificationChannel): NotificationChannelRenderProps => ({
    name: summary,
    type: getOptionFrom(type),
    routing: routingKey,
    service: serviceKey,
  }),
  [NotificationChannelType.slack]: ({
    type,
    summary,
    channel,
  }: SlackNotificationChannel): NotificationChannelRenderProps => ({
    name: summary,
    type: getOptionFrom(type),
    channel: channel,
  }),
};

export const getInitialValues = (notificationChannel?: NotificationChannel) =>
  notificationChannel
    ? INITIAL_VALUES[notificationChannel.type](
        notificationChannel as EmailNotificationChannel & SlackNotificationChannel & PagerDutylNotificationChannel
      )
    : { type: TYPE_OPTIONS[0] };

export const getOptionFrom = (type: NotificationChannelType) => TYPE_OPTIONS.find(opt => opt.value === type);
