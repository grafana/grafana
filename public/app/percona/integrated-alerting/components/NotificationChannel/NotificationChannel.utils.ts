import {
  NotificationChannelType,
  NotificationChannelAPI,
  EmailNotificationChannel,
  PagerDutylNotificationChannel,
  SlackNotificationChannel,
  NotificationChannelRenderProps,
  WebHookNotificationChannel,
  WebHookAuthType,
} from './NotificationChannel.types';
import { Messages } from './NotificationChannel.messages';

export const TO_MODEL = {
  [NotificationChannelType.email]: (channel: NotificationChannelAPI): EmailNotificationChannel => ({
    type: NotificationChannelType.email,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.email_config?.send_resolved,
    emails: channel.email_config?.to,
  }),
  [NotificationChannelType.pagerDuty]: (channel: NotificationChannelAPI): PagerDutylNotificationChannel => ({
    type: NotificationChannelType.pagerDuty,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.pagerduty_config?.send_resolved,
    routingKey: channel.pagerduty_config?.routing_key,
    serviceKey: channel.pagerduty_config?.service_key,
  }),
  [NotificationChannelType.slack]: (channel: NotificationChannelAPI): SlackNotificationChannel => ({
    type: NotificationChannelType.slack,
    channelId: channel.channel_id,
    summary: channel.summary,
    disabled: channel.disabled,
    sendResolved: channel.slack_config?.send_resolved,
    channel: channel.slack_config?.channel,
  }),
  [NotificationChannelType.webhook]: ({
    channel_id,
    summary,
    disabled,
    webhook_config,
  }: NotificationChannelAPI): WebHookNotificationChannel => ({
    type: NotificationChannelType.webhook,
    channelId: channel_id,
    summary: summary,
    disabled: disabled,
    sendResolved: !!webhook_config?.send_resolved,
    url: webhook_config?.url || '',
    username: webhook_config?.http_config.basic_auth?.username,
    password: webhook_config?.http_config.basic_auth?.password,
    token: webhook_config?.http_config.bearer_token,
    ca: webhook_config?.http_config.tls_config?.ca_file_content,
    cert: webhook_config?.http_config.tls_config?.cert_file_content,
    key: webhook_config?.http_config.tls_config?.key_file_content,
    serverName: webhook_config?.http_config.tls_config?.server_name,
    skipVerify: webhook_config?.http_config.tls_config?.insecure_skip_verify,
    maxAlerts: webhook_config?.max_alerts,
  }),
};

export const TO_API = {
  [NotificationChannelType.email]: (values: NotificationChannelRenderProps): NotificationChannelAPI => ({
    summary: values.name,
    email_config: {
      to: values.emails?.split('\n'),
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
  [NotificationChannelType.webhook]: (values: NotificationChannelRenderProps): NotificationChannelAPI => ({
    summary: values.name,
    webhook_config: {
      url: values.url,
      http_config: {
        basic_auth:
          values.webHookType === WebHookAuthType.basic
            ? {
                username: values.username,
                password: values.password,
              }
            : undefined,
        bearer_token: values.webHookType === WebHookAuthType.token ? values.token : undefined,
        tls_config: {
          ca_file_content: values.ca!,
          cert_file_content: values.cert!,
          key_file_content: values.key!,
          server_name: values.serverName!,
          insecure_skip_verify: !!values.skipVerify,
        },
      },
      max_alerts: values.maxAlerts,
      send_resolved: !!values.sendResolved,
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

  if (channel.webhook_config) {
    return NotificationChannelType.webhook;
  }

  throw new Error(Messages.missingTypeError);
};
