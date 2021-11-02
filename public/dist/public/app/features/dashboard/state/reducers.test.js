import { __awaiter, __generator } from "tslib";
import { dashboardInitCompleted, dashboardInitFailed, dashboardInitFetching, dashboardInitSlow, loadDashboardPermissions, dashboardReducer, initialState, } from './reducers';
import { DashboardInitPhase, OrgRole, PermissionLevel } from 'app/types';
import { DashboardModel } from './DashboardModel';
describe('dashboard reducer', function () {
    describe('loadDashboardPermissions', function () {
        var state;
        beforeEach(function () {
            var action = loadDashboardPermissions([
                { id: 2, dashboardId: 1, role: OrgRole.Viewer, permission: PermissionLevel.View },
                { id: 3, dashboardId: 1, role: OrgRole.Editor, permission: PermissionLevel.Edit },
            ]);
            state = dashboardReducer(initialState, action);
        });
        it('should add permissions to state', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = state.permissions) === null || _a === void 0 ? void 0 : _a.length).toBe(2);
                return [2 /*return*/];
            });
        }); });
    });
    describe('dashboardInitCompleted', function () {
        var state;
        beforeEach(function () {
            state = dashboardReducer(initialState, dashboardInitFetching());
            state = dashboardReducer(state, dashboardInitSlow());
            state = dashboardReducer(state, dashboardInitCompleted(new DashboardModel({
                title: 'My dashboard',
                panels: [{ id: 1 }, { id: 2 }],
            })));
        });
        it('should set model', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                expect(state.getModel().title).toBe('My dashboard');
                return [2 /*return*/];
            });
        }); });
        it('should set reset isInitSlow', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                expect(state.isInitSlow).toBe(false);
                return [2 /*return*/];
            });
        }); });
    });
    describe('dashboardInitFailed', function () {
        var state;
        beforeEach(function () {
            state = dashboardReducer(initialState, dashboardInitFetching());
            state = dashboardReducer(state, dashboardInitFailed({ message: 'Oh no', error: 'sad' }));
        });
        it('should set model', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = state.getModel()) === null || _a === void 0 ? void 0 : _a.title).toBe('Dashboard init failed');
                return [2 /*return*/];
            });
        }); });
        it('should set reset isInitSlow', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                expect(state.isInitSlow).toBe(false);
                return [2 /*return*/];
            });
        }); });
        it('should set initError', function () { return __awaiter(void 0, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                expect((_a = state.initError) === null || _a === void 0 ? void 0 : _a.message).toBe('Oh no');
                return [2 /*return*/];
            });
        }); });
        it('should set phase failed', function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                expect(state.initPhase).toBe(DashboardInitPhase.Failed);
                return [2 /*return*/];
            });
        }); });
    });
});
//# sourceMappingURL=reducers.test.js.map