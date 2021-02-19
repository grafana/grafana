import { api } from 'app/percona/shared/helpers/api';

import { NotificationChannelService } from './NotificationChannel.service';
import { NotificationChannelType } from './NotificationChannel.types';
import { notificationChannelResponseStubs, notificationChannelStubs } from './__mocks__/notificationChannelStubs';

jest.mock('app/percona/shared/helpers/api', () => ({
  api: {
    post: jest.fn(),
  },
}));
const postMock = jest.fn(() => new Promise(() => null));
(api.post as jest.Mock).mockImplementation(postMock);

describe('NotificationChannelService', () => {
  it('should return a list of notification channels', async () => {
    postMock.mockImplementation(() => {
      return Promise.resolve({ channels: notificationChannelResponseStubs });
    });

    const channels = await NotificationChannelService.list();

    expect(channels).toEqual(notificationChannelStubs);
  });

  it('should request the API to create notification channel with the correct format', async () => {
    const values = {
      name: 'Test email channel',
      type: { value: NotificationChannelType.email },
      emails: 'test1@percona.com\ntest2@percona.com',
    };
    const result = {
      summary: 'Test email channel',
      email_config: {
        to: ['test1@percona.com', 'test2@percona.com'],
      },
    };

    await NotificationChannelService.add(values);

    expect(postMock).toHaveBeenCalledWith(expect.anything(), result);
  });
});
