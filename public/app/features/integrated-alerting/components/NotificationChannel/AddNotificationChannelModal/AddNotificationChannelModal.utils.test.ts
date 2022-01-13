import { TYPE_OPTIONS } from './AddNotificationChannel.constants';
import { notificationChannelStubs } from '../__mocks__/notificationChannelStubs';
import { getInitialValues } from './AddNotificationChannelModal.utils';
import { EmailNotificationChannel } from '../NotificationChannel.types';

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
