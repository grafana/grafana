import { __awaiter } from "tslib";
import { DashboardInitPhase, OrgRole, PermissionLevel } from 'app/types';
import { createDashboardModelFixture, createPanelSaveModel } from './__fixtures__/dashboardFixtures';
import { dashboardInitCompleted, dashboardInitFailed, dashboardInitFetching, loadDashboardPermissions, dashboardReducer, initialState, } from './reducers';
describe('dashboard reducer', () => {
    describe('loadDashboardPermissions', () => {
        let state;
        beforeEach(() => {
            const action = loadDashboardPermissions([
                { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
                { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
            ]);
            state = dashboardReducer(initialState, action);
        });
        it('should add permissions to state', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = state.permissions) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
        }));
    });
    describe('dashboardInitCompleted', () => {
        let state;
        beforeEach(() => {
            state = dashboardReducer(initialState, dashboardInitFetching());
            state = dashboardReducer(state, dashboardInitCompleted(createDashboardModelFixture({
                title: 'My dashboard',
                panels: [createPanelSaveModel({ id: 1 }), createPanelSaveModel({ id: 2 })],
            })));
        });
        it('should set model', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(state.getModel().title).toBe('My dashboard');
        }));
    });
    describe('dashboardInitFailed', () => {
        let state;
        beforeEach(() => {
            state = dashboardReducer(initialState, dashboardInitFetching());
            state = dashboardReducer(state, dashboardInitFailed({ message: 'Oh no', error: 'sad' }));
        });
        it('should set model', () => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            expect((_a = state.getModel()) === null || _a === void 0 ? void 0 : _a.title).toBe('Dashboard init failed');
        }));
        it('should set initError', () => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            expect((_b = state.initError) === null || _b === void 0 ? void 0 : _b.message).toBe('Oh no');
        }));
        it('should set phase failed', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(state.initPhase).toBe(DashboardInitPhase.Failed);
        }));
    });
});
//# sourceMappingURL=reducers.test.js.map