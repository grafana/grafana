import * as tslib_1 from "tslib";
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { initDashboard } from './initDashboard';
import { DashboardRouteInfo } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { dashboardInitFetching, dashboardInitCompleted, dashboardInitServices } from './actions';
jest.mock('app/core/services/backend_srv');
var mockStore = configureMockStore([thunk]);
function describeInitScenario(description, scenarioFn) {
    var _this = this;
    describe(description, function () {
        var timeSrv = { init: jest.fn() };
        var annotationsSrv = { init: jest.fn() };
        var unsavedChangesSrv = { init: jest.fn() };
        var variableSrv = { init: jest.fn() };
        var dashboardSrv = { setCurrent: jest.fn() };
        var keybindingSrv = { setupDashboardBindings: jest.fn() };
        var injectorMock = {
            get: function (name) {
                switch (name) {
                    case 'timeSrv':
                        return timeSrv;
                    case 'annotationsSrv':
                        return annotationsSrv;
                    case 'unsavedChangesSrv':
                        return unsavedChangesSrv;
                    case 'dashboardSrv':
                        return dashboardSrv;
                    case 'variableSrv':
                        return variableSrv;
                    case 'keybindingSrv':
                        return keybindingSrv;
                    default:
                        throw { message: 'Unknown service ' + name };
                }
            },
        };
        var setupFn = function () { };
        var ctx = {
            args: {
                $injector: injectorMock,
                $scope: {},
                fixUrl: false,
                routeInfo: DashboardRouteInfo.Normal,
            },
            backendSrv: getBackendSrv(),
            timeSrv: timeSrv,
            annotationsSrv: annotationsSrv,
            unsavedChangesSrv: unsavedChangesSrv,
            variableSrv: variableSrv,
            dashboardSrv: dashboardSrv,
            keybindingSrv: keybindingSrv,
            actions: [],
            storeState: {
                location: {
                    query: {},
                },
                user: {},
            },
            setup: function (fn) {
                setupFn = fn;
            },
        };
        beforeEach(function () { return tslib_1.__awaiter(_this, void 0, void 0, function () {
            var store;
            return tslib_1.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        setupFn();
                        store = mockStore(ctx.storeState);
                        return [4 /*yield*/, store.dispatch(initDashboard(ctx.args))];
                    case 1:
                        _a.sent();
                        ctx.actions = store.getActions();
                        return [2 /*return*/];
                }
            });
        }); });
        scenarioFn(ctx);
    });
}
describeInitScenario('Initializing new dashboard', function (ctx) {
    ctx.setup(function () {
        ctx.storeState.user.orgId = 12;
        ctx.args.routeInfo = DashboardRouteInfo.New;
    });
    it('Should send action dashboardInitFetching', function () {
        expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
    });
    it('Should send action dashboardInitServices ', function () {
        expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
    });
    it('Should update location with orgId query param', function () {
        expect(ctx.actions[2].type).toBe('UPDATE_LOCATION');
        expect(ctx.actions[2].payload.query.orgId).toBe(12);
    });
    it('Should send action dashboardInitCompleted', function () {
        expect(ctx.actions[3].type).toBe(dashboardInitCompleted.type);
        expect(ctx.actions[3].payload.title).toBe('New dashboard');
    });
    it('Should Initializing services', function () {
        expect(ctx.timeSrv.init).toBeCalled();
        expect(ctx.annotationsSrv.init).toBeCalled();
        expect(ctx.variableSrv.init).toBeCalled();
        expect(ctx.unsavedChangesSrv.init).toBeCalled();
        expect(ctx.keybindingSrv.setupDashboardBindings).toBeCalled();
        expect(ctx.dashboardSrv.setCurrent).toBeCalled();
    });
});
describeInitScenario('Initializing home dashboard', function (ctx) {
    ctx.setup(function () {
        ctx.args.routeInfo = DashboardRouteInfo.Home;
        ctx.backendSrv.get.mockReturnValue(Promise.resolve({
            redirectUri: '/u/123/my-home',
        }));
    });
    it('Should redirect to custom home dashboard', function () {
        expect(ctx.actions[1].type).toBe('UPDATE_LOCATION');
        expect(ctx.actions[1].payload.path).toBe('/u/123/my-home');
    });
});
//# sourceMappingURL=initDashboard.test.js.map