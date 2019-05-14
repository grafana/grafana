jest.mock('app/core/core', function () { return ({}); });
jest.mock('app/core/config', function () {
    return {
        bootData: {
            user: {},
        },
        panels: {
            test: {
                id: 'test',
                name: 'test',
            },
        },
    };
});
import q from 'q';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { MetricsPanelCtrl } from '../metrics_panel_ctrl';
describe('MetricsPanelCtrl', function () {
    describe('when getting additional menu items', function () {
        describe('and has no datasource set but user has access to explore', function () {
            it('should not return any items', function () {
                var ctrl = setupController({ hasAccessToExplore: true });
                expect(ctrl.getAdditionalMenuItems().length).toBe(0);
            });
        });
        describe('and has datasource set that supports explore and user does not have access to explore', function () {
            it('should not return any items', function () {
                var ctrl = setupController({ hasAccessToExplore: false });
                ctrl.datasource = { meta: { explore: true } };
                expect(ctrl.getAdditionalMenuItems().length).toBe(0);
            });
        });
        describe('and has datasource set that supports explore and user has access to explore', function () {
            it('should return one item', function () {
                var ctrl = setupController({ hasAccessToExplore: true });
                ctrl.datasource = { meta: { explore: true } };
                expect(ctrl.getAdditionalMenuItems().length).toBe(1);
            });
        });
    });
});
function setupController(_a) {
    var hasAccessToExplore = (_a === void 0 ? { hasAccessToExplore: false } : _a).hasAccessToExplore;
    var injectorStub = {
        get: function (type) {
            switch (type) {
                case '$q': {
                    return q;
                }
                case 'contextSrv': {
                    return { hasAccessToExplore: function () { return hasAccessToExplore; } };
                }
                default: {
                    return jest.fn();
                }
            }
        },
    };
    var scope = {
        panel: { events: [] },
        appEvent: jest.fn(),
        onAppEvent: jest.fn(),
        $on: jest.fn(),
        colors: [],
    };
    MetricsPanelCtrl.prototype.panel = new PanelModel({ type: 'test' });
    return new MetricsPanelCtrl(scope, injectorStub);
}
//# sourceMappingURL=metrics_panel_ctrl.test.js.map