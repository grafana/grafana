import { __awaiter } from "tslib";
jest.mock('app/core/core', () => ({}));
jest.mock('app/core/config', () => {
    return Object.assign(Object.assign({}, jest.requireActual('app/core/config')), { bootData: {
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
describe('MetricsPanelCtrl', () => {
    describe('can setup', () => {
        it('should return controller', () => __awaiter(void 0, void 0, void 0, function* () {
            const ctrl = setupController({ hasAccessToExplore: true });
            expect((yield ctrl.getAdditionalMenuItems()).length).toBe(0);
        }));
    });
});
function setupController({ hasAccessToExplore } = { hasAccessToExplore: false }) {
    const injectorStub = {
        get: (type) => {
            switch (type) {
                case 'contextSrv': {
                    return { hasAccessToExplore: () => hasAccessToExplore };
                }
                case 'timeSrv': {
                    return { timeRangeForUrl: () => { } };
                }
                default: {
                    return jest.fn();
                }
            }
        },
    };
    const scope = {
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