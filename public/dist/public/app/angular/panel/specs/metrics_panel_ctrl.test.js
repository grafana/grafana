import { __assign, __awaiter, __generator } from "tslib";
jest.mock('app/core/core', function () { return ({}); });
jest.mock('app/core/config', function () {
    return __assign(__assign({}, jest.requireActual('app/core/config')), { bootData: {
            user: {},
        }, panels: {
            test: {
                id: 'test',
                name: 'test',
            },
        }, config: {
            appSubUrl: 'test',
        } });
});
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { MetricsPanelCtrl } from '../metrics_panel_ctrl';
describe('MetricsPanelCtrl', function () {
    describe('can setup', function () {
        it('should return controller', function () { return __awaiter(void 0, void 0, void 0, function () {
            var ctrl, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        ctrl = setupController({ hasAccessToExplore: true });
                        _a = expect;
                        return [4 /*yield*/, ctrl.getAdditionalMenuItems()];
                    case 1:
                        _a.apply(void 0, [(_b.sent()).length]).toBe(0);
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
function setupController(_a) {
    var _b = _a === void 0 ? { hasAccessToExplore: false } : _a, hasAccessToExplore = _b.hasAccessToExplore;
    var injectorStub = {
        get: function (type) {
            switch (type) {
                case 'contextSrv': {
                    return { hasAccessToExplore: function () { return hasAccessToExplore; } };
                }
                case 'timeSrv': {
                    return { timeRangeForUrl: function () { } };
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
        $parent: {
            panel: new PanelModel({ type: 'test' }),
            dashboard: {},
        },
    };
    return new MetricsPanelCtrl(scope, injectorStub);
}
//# sourceMappingURL=metrics_panel_ctrl.test.js.map