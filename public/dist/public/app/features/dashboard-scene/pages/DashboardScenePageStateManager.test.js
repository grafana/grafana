import { __awaiter } from "tslib";
import { locationService } from '@grafana/runtime';
import { getUrlSyncManager } from '@grafana/scenes';
import { DashboardScene } from '../scene/DashboardScene';
import { setupLoadDashboardMock } from '../utils/test-utils';
import { DashboardScenePageStateManager } from './DashboardScenePageStateManager';
describe('DashboardScenePageStateManager', () => {
    describe('when fetching/loading a dashboard', () => {
        it('should call loader from server if the dashboard is not cached', () => __awaiter(void 0, void 0, void 0, function* () {
            const loadDashboardMock = setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });
            const loader = new DashboardScenePageStateManager({});
            yield loader.loadDashboard('fake-dash');
            expect(loadDashboardMock).toHaveBeenCalledWith('db', '', 'fake-dash');
            // should use cache second time
            yield loader.loadDashboard('fake-dash');
            expect(loadDashboardMock.mock.calls.length).toBe(1);
        }));
        it("should error when the dashboard doesn't exist", () => __awaiter(void 0, void 0, void 0, function* () {
            setupLoadDashboardMock({ dashboard: undefined, meta: {} });
            const loader = new DashboardScenePageStateManager({});
            yield loader.loadDashboard('fake-dash');
            expect(loader.state.dashboard).toBeUndefined();
            expect(loader.state.isLoading).toBe(false);
            expect(loader.state.loadError).toBe('Error: Dashboard not found');
        }));
        it('should initialize the dashboard scene with the loaded dashboard', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });
            const loader = new DashboardScenePageStateManager({});
            yield loader.loadDashboard('fake-dash');
            expect((_a = loader.state.dashboard) === null || _a === void 0 ? void 0 : _a.state.uid).toBe('fake-dash');
            expect(loader.state.loadError).toBe(undefined);
            expect(loader.state.isLoading).toBe(false);
        }));
        it('should use DashboardScene creator to initialize the scene', () => __awaiter(void 0, void 0, void 0, function* () {
            setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });
            const loader = new DashboardScenePageStateManager({});
            yield loader.loadDashboard('fake-dash');
            expect(loader.state.dashboard).toBeInstanceOf(DashboardScene);
            expect(loader.state.isLoading).toBe(false);
        }));
        it('should initialize url sync', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b, _c;
            setupLoadDashboardMock({ dashboard: { uid: 'fake-dash' }, meta: {} });
            locationService.partial({ from: 'now-5m', to: 'now' });
            const loader = new DashboardScenePageStateManager({});
            yield loader.loadDashboard('fake-dash');
            const dash = loader.state.dashboard;
            expect((_b = dash.state.$timeRange) === null || _b === void 0 ? void 0 : _b.state.from).toEqual('now-5m');
            getUrlSyncManager().cleanUp(dash);
            // try loading again (and hitting cache)
            locationService.partial({ from: 'now-10m', to: 'now' });
            yield loader.loadDashboard('fake-dash');
            const dash2 = loader.state.dashboard;
            expect((_c = dash2.state.$timeRange) === null || _c === void 0 ? void 0 : _c.state.from).toEqual('now-10m');
        }));
    });
});
//# sourceMappingURL=DashboardScenePageStateManager.test.js.map