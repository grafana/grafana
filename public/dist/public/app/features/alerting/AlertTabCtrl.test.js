import { AlertTabCtrl } from './AlertTabCtrl';
function setupTestContext(_a) {
    var _b = _a === void 0 ? {} : _a, _c = _b.notifications, notifications = _c === void 0 ? [] : _c;
    var panel = {
        alert: { notifications: notifications },
        options: [],
        title: 'Testing Alerts',
    };
    var $scope = {
        ctrl: {
            panel: panel,
            render: jest.fn(),
        },
    };
    var dashboardSrv = {};
    var uiSegmentSrv = {};
    var datasourceSrv = {};
    var controller = new AlertTabCtrl($scope, dashboardSrv, uiSegmentSrv, datasourceSrv);
    controller.notifications = notifications;
    controller.alertNotifications = [];
    controller.initModel();
    return { controller: controller };
}
describe('AlertTabCtrl', function () {
    describe('when removeNotification is called with an uid', function () {
        it('then the correct notifier should be removed', function () {
            var controller = setupTestContext({
                notifications: [
                    { id: 1, uid: 'one', isDefault: true },
                    { id: 2, uid: 'two', isDefault: false },
                ],
            }).controller;
            expect(controller.alert.notifications).toEqual([
                { id: 1, uid: 'one', isDefault: true, iconClass: 'bell' },
                { id: 2, uid: 'two', isDefault: false, iconClass: 'bell' },
            ]);
            expect(controller.alertNotifications).toEqual([
                { id: 2, uid: 'two', isDefault: false, iconClass: 'bell' },
                { id: 1, uid: 'one', isDefault: true, iconClass: 'bell' },
            ]);
            controller.removeNotification({ uid: 'one' });
            expect(controller.alert.notifications).toEqual([{ id: 2, uid: 'two', isDefault: false, iconClass: 'bell' }]);
            expect(controller.alertNotifications).toEqual([{ id: 2, uid: 'two', isDefault: false, iconClass: 'bell' }]);
        });
    });
    describe('when removeNotification is called with an id', function () {
        it('then the correct notifier should be removed', function () {
            var controller = setupTestContext({
                notifications: [
                    { id: 1, uid: 'one', isDefault: true },
                    { id: 2, uid: 'two', isDefault: false },
                ],
            }).controller;
            expect(controller.alert.notifications).toEqual([
                { id: 1, uid: 'one', isDefault: true, iconClass: 'bell' },
                { id: 2, uid: 'two', isDefault: false, iconClass: 'bell' },
            ]);
            expect(controller.alertNotifications).toEqual([
                { id: 2, uid: 'two', isDefault: false, iconClass: 'bell' },
                { id: 1, uid: 'one', isDefault: true, iconClass: 'bell' },
            ]);
            controller.removeNotification({ id: 2 });
            expect(controller.alert.notifications).toEqual([{ id: 1, uid: 'one', isDefault: true, iconClass: 'bell' }]);
            expect(controller.alertNotifications).toEqual([{ id: 1, uid: 'one', isDefault: true, iconClass: 'bell' }]);
        });
    });
});
//# sourceMappingURL=AlertTabCtrl.test.js.map