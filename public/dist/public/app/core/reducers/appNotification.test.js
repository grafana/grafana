import { appNotificationsReducer, clearAppNotification, notifyApp } from './appNotification';
import { AppNotificationSeverity, AppNotificationTimeout } from 'app/types/';
describe('clear alert', function () {
    it('should filter alert', function () {
        var id1 = '1767d3d9-4b99-40eb-ab46-de734a66f21d';
        var id2 = '4767b3de-12dd-40e7-b58c-f778bd59d675';
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
        var result = appNotificationsReducer(initialState, clearAppNotification(id2));
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
describe('notify', function () {
    it('create notify message', function () {
        var id1 = '696da53b-6ae7-4824-9e0e-d6a3b54a2c74';
        var id2 = '4477fcd9-246c-45a5-8818-e22a16683dae';
        var id3 = '55be87a8-bbab-45c7-b481-1f9d46f0d2ee';
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
        var result = appNotificationsReducer(initialState, notifyApp({
            id: id3,
            severity: AppNotificationSeverity.Info,
            icon: 'info',
            title: 'test3',
            text: 'test alert info 3',
            timeout: AppNotificationTimeout.Success,
        }));
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
    it('Dedupe identical alerts', function () {
        var initialState = {
            appNotifications: [
                {
                    id: 'id1',
                    severity: AppNotificationSeverity.Success,
                    icon: 'success',
                    title: 'test',
                    text: 'test alert',
                    timeout: AppNotificationTimeout.Success,
                },
            ],
        };
        var result = appNotificationsReducer(initialState, notifyApp({
            id: 'id2',
            severity: AppNotificationSeverity.Success,
            icon: 'success',
            title: 'test',
            text: 'test alert',
            timeout: AppNotificationTimeout.Success,
        }));
        var expectedResult = {
            appNotifications: [
                {
                    id: 'id1',
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