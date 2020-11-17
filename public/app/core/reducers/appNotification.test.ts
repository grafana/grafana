import { appNotificationsReducer, clearAppNotification, notifyApp } from './appNotification';
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types/';

describe('clear alert', () => {
  it('should filter alert', () => {
    const id1 = '1767d3d9-4b99-40eb-ab46-de734a66f21d';
    const id2 = '4767b3de-12dd-40e7-b58c-f778bd59d675';

    const initialState = {
      appNotifications: [
        {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          timeout: AppNotificationTimeout.Success,
        },
        {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          timeout: AppNotificationTimeout.Warning,
        },
      ],
    };

    const result = appNotificationsReducer(initialState, clearAppNotification(id2));

    const expectedResult = {
      appNotifications: [
        {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          timeout: AppNotificationTimeout.Success,
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });
});

describe('notify', () => {
  it('create notify message', () => {
    const id1 = '696da53b-6ae7-4824-9e0e-d6a3b54a2c74';
    const id2 = '4477fcd9-246c-45a5-8818-e22a16683dae';
    const id3 = '55be87a8-bbab-45c7-b481-1f9d46f0d2ee';

    const initialState = {
      appNotifications: [
        {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          timeout: AppNotificationTimeout.Success,
        },
        {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          timeout: AppNotificationTimeout.Warning,
        },
      ],
    };

    const result = appNotificationsReducer(
      initialState,
      notifyApp({
        id: id3,
        severity: AppNotificationSeverity.Info,
        icon: 'info',
        title: 'test3',
        text: 'test alert info 3',
        timeout: AppNotificationTimeout.Success,
      })
    );

    const expectedResult = {
      appNotifications: [
        {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          timeout: AppNotificationTimeout.Success,
        },
        {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          timeout: AppNotificationTimeout.Warning,
        },
        {
          id: id3,
          severity: AppNotificationSeverity.Info,
          icon: 'info',
          title: 'test3',
          text: 'test alert info 3',
          timeout: AppNotificationTimeout.Success,
        },
      ],
    };

    expect(result).toEqual(expectedResult);
  });
});
