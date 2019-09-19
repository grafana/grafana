import { appNotificationsReducer } from './appNotification';
import { ActionTypes } from '../actions/appNotification';
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types/';

describe('clear alert', () => {
  it('should filter alert', () => {
    const id1 = 1540301236048;
    const id2 = 1540301248293;

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

    const result = appNotificationsReducer(initialState, {
      type: ActionTypes.ClearAppNotification,
      payload: id2,
    });

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
