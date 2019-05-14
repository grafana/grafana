var _this = this;
import * as tslib_1 from "tslib";
import { loadDashboardPermissions, dashboardInitFetching, dashboardInitCompleted, dashboardInitFailed, dashboardInitSlow, } from './actions';
import { OrgRole, PermissionLevel, DashboardInitPhase } from 'app/types';
import { initialState, dashboardReducer } from './reducers';
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
        it('should add permissions to state', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.permissions.length).toBe(2);
                return [2 /*return*/];
            });
        }); });
    });
    describe('dashboardInitCompleted', function () {
        var state;
        beforeEach(function () {
            state = dashboardReducer(initialState, dashboardInitFetching());
            state = dashboardReducer(state, dashboardInitSlow());
            state = dashboardReducer(state, dashboardInitCompleted(new DashboardModel({ title: 'My dashboard' })));
        });
        it('should set model', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.model.title).toBe('My dashboard');
                return [2 /*return*/];
            });
        }); });
        it('should set reset isInitSlow', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
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
        it('should set model', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.model.title).toBe('Dashboard init failed');
                return [2 /*return*/];
            });
        }); });
        it('should set reset isInitSlow', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.isInitSlow).toBe(false);
                return [2 /*return*/];
            });
        }); });
        it('should set initError', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.initError.message).toBe('Oh no');
                return [2 /*return*/];
            });
        }); });
        it('should set phase failed', function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            return tslib_1.__generator(this, function (_a) {
                expect(state.initPhase).toBe(DashboardInitPhase.Failed);
                return [2 /*return*/];
            });
        }); });
    });
});
//# sourceMappingURL=reducers.test.js.map