import { EmailNotificationChannel } from '../NotificationChannel.types';
import { notificationChannelStubs } from '../__mocks__/notificationChannelStubs';

import { TYPE_OPTIONS } from './AddNotificationChannel.constants';
import { getInitialValues } from './AddNotificationChannelModal.utils';

describe('AddNotificationChannelModal.utils', () => {
  it('should return correct initial values for notification channel', () => {
    const notificationChannel = notificationChannelStubs[0] as EmailNotificationChannel;
    const initialValues = getInitialValues(notificationChannel);

    expect(initialValues).toEqual({
      name: notificationChannel.summary,
      type: TYPE_OPTIONS[0],
      emails: notificationChannel.emails.join('\n'),
    });
  });

  it('should return correct initial values without notification channel', () => {
    const initialValues = getInitialValues();

    expect(initialValues).toEqual({ type: TYPE_OPTIONS[0] });
  });
});
