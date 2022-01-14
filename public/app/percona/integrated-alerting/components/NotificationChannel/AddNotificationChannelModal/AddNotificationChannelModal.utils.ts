import {
  NotificationChannel,
  NotificationChannelType,
  EmailNotificationChannel,
  NotificationChannelRenderProps,
  PagerDutylNotificationChannel,
  SlackNotificationChannel,
  PagerDutyKeyType,
} from '../NotificationChannel.types';
import { TYPE_OPTIONS, PAGER_DUTY_TYPE_OPTIONS } from './AddNotificationChannel.constants';

export const INITIAL_VALUES = {
  [NotificationChannelType.email]: ({
    type,
    summary,
    emails,
  }: EmailNotificationChannel): NotificationChannelRenderProps => ({
    name: summary,
    type: getOptionFrom(type),
    emails: emails?.join('\n'),
  }),
  [NotificationChannelType.pagerDuty]: ({
    type,
    summary,
    routingKey,
    serviceKey,
  }: PagerDutylNotificationChannel): NotificationChannelRenderProps => ({
    name: summary,
    type: getOptionFrom(type),
    keyType: serviceKey ? PagerDutyKeyType.service : PagerDutyKeyType.routing,
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

export const getInitialValues = (notificationChannel?: NotificationChannel) => {
  const defaultValues: NotificationChannelRenderProps = {
    name: '',
    type: TYPE_OPTIONS[0],
    keyType: PAGER_DUTY_TYPE_OPTIONS[0].value,
    routing: '',
    service: '',
    emails: '',
    channel: '',
  };

  return notificationChannel
    ? INITIAL_VALUES[notificationChannel.type](
        notificationChannel as EmailNotificationChannel & SlackNotificationChannel & PagerDutylNotificationChannel
      )
    : defaultValues;
};
export const getOptionFrom = (type: NotificationChannelType) => TYPE_OPTIONS.find((opt) => opt.value === type);
