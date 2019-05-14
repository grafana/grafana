import { SaveProvisionedDashboardModalCtrl } from './SaveProvisionedDashboardModalCtrl';
describe('SaveProvisionedDashboardModalCtrl', function () {
    var json = {
        title: 'name',
        id: 5,
    };
    var mockDashboardSrv = {
        getCurrent: function () {
            return {
                id: 5,
                meta: {},
                getSaveModelClone: function () {
                    return json;
                },
            };
        },
    };
    var ctrl = new SaveProvisionedDashboardModalCtrl(mockDashboardSrv);
    it('should remove id from dashboard model', function () {
        expect(ctrl.dash.id).toBeUndefined();
    });
    it('should remove id from dashboard model in clipboard json', function () {
        expect(ctrl.getJsonForClipboard()).toBe(JSON.stringify({ title: 'name' }, null, 2));
    });
});
//# sourceMappingURL=SaveProvisionedDashboardModalCtrl.test.js.map