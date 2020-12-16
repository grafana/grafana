import { NotificationChannelService } from './NotificationChannel.service';
import { notificationChannelResponseStubs, notificationChannelStubs } from './__mocks__/notificationChannelStubs';
import { NotificationChannelType } from './NotificationChannel.types';

const postMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    post: postMock,
  }),
}));

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
