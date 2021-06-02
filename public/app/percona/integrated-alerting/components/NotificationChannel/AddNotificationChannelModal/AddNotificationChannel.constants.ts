import { NotificationChannelType, PagerDutyKeyType } from '../NotificationChannel.types';
import { Messages } from './AddNotificationChannelModal.messages';
import { EmailFields } from './EmailFields/EmailFields';
import { PagerDutyFields } from './PagerDutyFields/PagerDutyFields';
import { SlackFields } from './SlackFields/SlackFields';

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
];

export const TYPE_FIELDS_COMPONENT = {
  [NotificationChannelType.email]: EmailFields,
  [NotificationChannelType.pagerDuty]: PagerDutyFields,
  [NotificationChannelType.slack]: SlackFields,
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
