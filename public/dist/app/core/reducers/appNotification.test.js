import { appNotificationsReducer } from './appNotification';
import { ActionTypes } from '../actions/appNotification';
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types/';
describe('clear alert', function () {
    it('should filter alert', function () {
        var id1 = 1540301236048;
        var id2 = 1540301248293;
        var initialState = {
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
        var result = appNotificationsReducer(initialState, {
            type: ActionTypes.ClearAppNotification,
            payload: id2,
        });
        var expectedResult = {
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
//# sourceMappingURL=appNotification.test.js.map