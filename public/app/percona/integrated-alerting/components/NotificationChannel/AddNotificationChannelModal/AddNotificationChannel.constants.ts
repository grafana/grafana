import { NotificationChannelType, PagerDutyKeyType, WebHookAuthType } from '../NotificationChannel.types';
import { Messages } from './AddNotificationChannelModal.messages';
import { EmailFields } from './EmailFields/EmailFields';
import { PagerDutyFields } from './PagerDutyFields/PagerDutyFields';
import { SlackFields } from './SlackFields/SlackFields';
import { WebHookFields } from './WebHookFields/WebHookFields';

export const TYPE_OPTIONS = [
  {
    value: NotificationChannelType.email,
    label: Messages.emailOption,
  },
  {
    value: NotificationChannelType.pagerDuty,
    label: Messages.pagerDutyOption,
  },
  {
    value: NotificationChannelType.slack,
    label: Messages.slackOption,
  },
  {
    value: NotificationChannelType.webhook,
    label: Messages.webHookOption,
  },
];

export const TYPE_FIELDS_COMPONENT = {
  [NotificationChannelType.email]: EmailFields,
  [NotificationChannelType.pagerDuty]: PagerDutyFields,
  [NotificationChannelType.slack]: SlackFields,
  [NotificationChannelType.webhook]: WebHookFields,
};

export const PAGER_DUTY_TYPE_OPTIONS = [
  {
    value: PagerDutyKeyType.routing,
    label: Messages.fields.routingKey,
  },
  {
    value: PagerDutyKeyType.service,
    label: Messages.fields.serviceKey,
  },
];

export const WEBHOOK_TYPE_OPTIONS = [
  {
    value: WebHookAuthType.basic,
    label: Messages.fields.basic,
  },
  {
    value: WebHookAuthType.token,
    label: Messages.fields.token,
  },
  {
    value: WebHookAuthType.none,
    label: Messages.fields.noAuth,
  },
];
