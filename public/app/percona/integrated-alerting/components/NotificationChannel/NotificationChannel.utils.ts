import {
  NotificationChannelType,
  NotificationChannelAPI,
  EmailNotificationChannel,
  PagerDutylNotificationChannel,
  SlackNotificationChannel,
  NotificationChannelRenderProps,
} from './NotificationChannel.types';
import { Messages } from './NotificationChannel.messages';

export const TO_MODEL = {
  [NotificationChannelType.email]: (channel: NotificationChannelAPI): EmailNotificationChannel => ({
    type: NotificationChannelType.email,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.email_config.send_resolved,
    emails: channel.email_config.to,
  }),
  [NotificationChannelType.pagerDuty]: (channel: NotificationChannelAPI): PagerDutylNotificationChannel => ({
    type: NotificationChannelType.pagerDuty,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.pagerduty_config.send_resolved,
    routingKey: channel.pagerduty_config.routing_key,
    serviceKey: channel.pagerduty_config.service_key,
  }),
  [NotificationChannelType.slack]: (channel: NotificationChannelAPI): SlackNotificationChannel => ({
    type: NotificationChannelType.slack,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.slack_config.send_resolved,
    channel: channel.slack_config.channel,
  }),
};

export const TO_API = {
  [NotificationChannelType.email]: (values: NotificationChannelRenderProps): NotificationChannelAPI => ({
    summary: values.name,
    email_config: {
      to: values.emails.split('\n'),
    },
  }),
  [NotificationChannelType.pagerDuty]: (values: NotificationChannelRenderProps): NotificationChannelAPI => ({
    summary: values.name,
    pagerduty_config: {
      routing_key: values.routing,
      service_key: values.service,
    },
  }),
  [NotificationChannelType.slack]: (values: NotificationChannelRenderProps): NotificationChannelAPI => ({
    summary: values.name,
    slack_config: {
      channel: values.channel,
    },
  }),
};

export const getType = (channel: NotificationChannelAPI): NotificationChannelType => {
  if (channel.email_config) {
    return NotificationChannelType.email;
  }

  if (channel.pagerduty_config) {
    return NotificationChannelType.pagerDuty;
  }

  if (channel.slack_config) {
    return NotificationChannelType.slack;
  }

  throw new Error(Messages.missingTypeError);
};
