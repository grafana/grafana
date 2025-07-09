import { AppNotificationSeverity, AppNotificationsState } from 'app/types/appNotifications';

import { appNotificationsReducer, clearNotification, notifyApp } from './appNotification';

const timestamp = 1649849468889;
describe('clear alert', () => {
  it('should filter alert', () => {
    const id1 = '1767d3d9-4b99-40eb-ab46-de734a66f21d';
    const id2 = '4767b3de-12dd-40e7-b58c-f778bd59d675';

    const initialState: AppNotificationsState = {
      byId: {
        [id1]: {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          showing: true,
          timestamp,
        },
        [id2]: {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          showing: true,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    const result = appNotificationsReducer(initialState, clearNotification(id2));

    const expectedResult: AppNotificationsState = {
      byId: {
        [id1]: {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          showing: true,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    expect(result).toEqual(expectedResult);
  });
});

describe('notify', () => {
  it('create notify message', () => {
    const id1 = '696da53b-6ae7-4824-9e0e-d6a3b54a2c74';
    const id2 = '4477fcd9-246c-45a5-8818-e22a16683dae';
    const id3 = '55be87a8-bbab-45c7-b481-1f9d46f0d2ee';

    const initialState: AppNotificationsState = {
      byId: {
        [id1]: {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          showing: true,
          timestamp,
        },
        [id2]: {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          showing: true,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    const result = appNotificationsReducer(
      initialState,
      notifyApp({
        id: id3,
        severity: AppNotificationSeverity.Info,
        icon: 'info',
        title: 'test3',
        text: 'test alert info 3',
        showing: true,
        timestamp: 1649802870373,
      })
    );

    const expectedResult: AppNotificationsState = {
      byId: {
        [id1]: {
          id: id1,
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          timestamp,
          showing: true,
        },
        [id2]: {
          id: id2,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test2',
          text: 'test alert fail 2',
          timestamp,
          showing: true,
        },
        [id3]: {
          id: id3,
          severity: AppNotificationSeverity.Info,
          icon: 'info',
          title: 'test3',
          text: 'test alert info 3',
          timestamp: 1649802870373,
          showing: true,
        },
      },
      lastRead: timestamp - 10,
    };

    expect(result).toEqual(expectedResult);
  });

  it('Dedupe identical alerts', () => {
    const initialState: AppNotificationsState = {
      byId: {
        id1: {
          id: 'id1',
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          showing: true,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    const result = appNotificationsReducer(
      initialState,
      notifyApp({
        id: 'id2',
        severity: AppNotificationSeverity.Success,
        icon: 'success',
        title: 'test',
        text: 'test alert',
        showing: true,
        timestamp,
      })
    );

    const expectedResult: AppNotificationsState = {
      byId: {
        id1: {
          id: 'id1',
          severity: AppNotificationSeverity.Success,
          icon: 'success',
          title: 'test',
          text: 'test alert',
          showing: true,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    expect(result).toEqual(expectedResult);
  });

  it('persists notifications to localStorage', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem');

    const id1 = '696da53b-6ae7-4824-9e0e-d6a3b54a2c74';
    const id2 = '4477fcd9-246c-45a5-8818-e22a16683dae';

    const initialState: AppNotificationsState = {
      byId: {
        [id1]: {
          id: id1,
          severity: AppNotificationSeverity.Warning,
          icon: 'warning',
          title: 'test',
          text: 'test alert',
          showing: false,
          timestamp,
        },
      },
      lastRead: timestamp - 10,
    };

    appNotificationsReducer(
      initialState,
      notifyApp({
        id: id2,
        severity: AppNotificationSeverity.Error,
        icon: 'error',
        title: 'test2',
        text: 'test alert info 2',
        showing: true,
        timestamp: 1649802870373,
      })
    );

    expect(setItemSpy).toHaveBeenCalledTimes(1);

    const [calledKey, calledValue] = setItemSpy.mock.calls[0];
    const parsedJsonCalledValue = JSON.parse(calledValue);
    expect(calledKey).toBe('notifications');

    // Assert showing toasts are not still showing after page refresh
    expect(parsedJsonCalledValue[id1].showing).toBeFalsy(); // old notification that was false anyway
    expect(parsedJsonCalledValue[id2].showing).toBeFalsy(); // new notification that we store as false

    expect(parsedJsonCalledValue).toEqual({
      [id1]: {
        id: id1,
        severity: AppNotificationSeverity.Warning,
        icon: 'warning',
        title: 'test',
        text: 'test alert',
        showing: false,
        timestamp,
      },
      [id2]: {
        id: id2,
        severity: AppNotificationSeverity.Error,
        icon: 'error',
        title: 'test2',
        text: 'test alert info 2',
        showing: false,
        timestamp: 1649802870373,
      },
    });
  });
});
