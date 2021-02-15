import { AlertTabCtrl } from './AlertTabCtrl';

interface Args {
  notifications?: Array<{ uid?: string; id?: number; isDefault: boolean }>;
}

function setupTestContext({ notifications = [] }: Args = {}) {
  const panel = {
    alert: { notifications },
    options: [],
    title: 'Testing Alerts',
  };
  const $scope = {
    ctrl: {
      panel,
      render: jest.fn(),
    },
  };
  const dashboardSrv: any = {};
  const uiSegmentSrv: any = {};
  const datasourceSrv: any = {};

  const controller = new AlertTabCtrl($scope, dashboardSrv, uiSegmentSrv, datasourceSrv);
  controller.notifications = notifications;
  controller.alertNotifications = [];
  controller.initModel();

  return { controller };
}

describe('AlertTabCtrl', () => {
  describe('when removeNotification is called with an uid', () => {
    it('then the correct notifier should be removed', () => {
      const { controller } = setupTestContext({
        notifications: [
          { id: 1, uid: 'one', isDefault: true },
          { id: 2, uid: 'two', isDefault: false },
        ],
      });

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

  describe('when removeNotification is called with an id', () => {
    it('then the correct notifier should be removed', () => {
      const { controller } = setupTestContext({
        notifications: [
          { id: 1, uid: 'one', isDefault: true },
          { id: 2, uid: 'two', isDefault: false },
        ],
      });

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
