import { NotificationChannelType } from './NotificationChannel.types';

export const Messages = {
  emptyTable: 'No notification channels found',
  nameColumn: 'Name',
  typeColumn: 'Type',
  typeLabel: {
    [NotificationChannelType.email]: 'Email',
    [NotificationChannelType.pagerDuty]: 'Pager Duty',
    [NotificationChannelType.slack]: 'Slack',
  },
  missingTypeError: "Notification channel type doesn't exist",
  addAction: 'Add',
};
