import { __assign, __awaiter, __generator } from "tslib";
import { Subject } from 'rxjs';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { locationService, setEchoSrv } from '@grafana/runtime';
import { initDashboard } from './initDashboard';
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { dashboardInitCompleted, dashboardInitFetching, dashboardInitServices } from './reducers';
import { Echo } from '../../../core/services/echo/Echo';
import { variableAdapters } from 'app/features/variables/adapters';
import { createConstantVariableAdapter } from 'app/features/variables/constant/adapter';
import { constantBuilder } from 'app/features/variables/shared/testing/builders';
import { TransactionStatus, variablesInitTransaction } from '../../variables/state/transactionReducer';
import { keybindingSrv } from 'app/core/services/keybindingSrv';
import { getTimeSrv, setTimeSrv } from '../services/TimeSrv';
import { setDashboardLoaderSrv } from '../services/DashboardLoaderSrv';
import { getDashboardSrv, setDashboardSrv } from '../services/DashboardSrv';
import { getDashboardQueryRunner, setDashboardQueryRunnerFactory, } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
import { emptyResult } from '../../query/state/DashboardQueryRunner/utils';
jest.mock('app/core/services/backend_srv');
jest.mock('app/features/dashboard/services/TimeSrv', function () {
    var original = jest.requireActual('app/features/dashboard/services/TimeSrv');
    return __assign(__assign({}, original), { getTimeSrv: function () { return (__assign(__assign({}, original.getTimeSrv()), { timeRange: jest.fn().mockReturnValue(undefined) })); } });
});
jest.mock('app/core/services/context_srv', function () { return ({
    contextSrv: {
        user: { orgId: 1, orgName: 'TestOrg' },
    },
}); });
variableAdapters.register(createConstantVariableAdapter());
var mockStore = configureMockStore([thunk]);
function describeInitScenario(description, scenarioFn) {
    var _this = this;
    describe(description, function () {
        var loaderSrv = {
            loadDashboard: jest.fn(function () { return ({
                meta: {
                    canStar: false,
                    canShare: false,
                    isNew: true,
                    folderId: 0,
                },
                dashboard: {
                    title: 'My cool dashboard',
                    panels: [
                        {
                            type: 'add-panel',
                            gridPos: { x: 0, y: 0, w: 12, h: 9 },
                            title: 'Panel Title',
                            id: 2,
                            targets: [
                                {
                                    refId: 'A',
                                    expr: 'old expr',
                                },
                            ],
                        },
                    ],
                    templating: {
                        list: [constantBuilder().build()],
                    },
                },
            }); }),
        };
        setDashboardLoaderSrv(loaderSrv);
        setDashboardQueryRunnerFactory(function () { return ({
            getResult: emptyResult,
            run: jest.fn(),
            cancel: function () { return undefined; },
            cancellations: function () { return new Subject(); },
            destroy: function () { return undefined; },
        }); });
        var setupFn = function () { };
        var ctx = {
            args: {
                urlUid: 'DGmvKKxZz',
                fixUrl: false,
                routeName: DashboardRoutes.Normal,
            },
            backendSrv: getBackendSrv(),
            loaderSrv: loaderSrv,
            actions: [],
            storeState: {
                location: {
                    query: {},
                },
                dashboard: {
                    initPhase: DashboardInitPhase.Services,
                },
                user: {},
                explore: {
                    left: {
                        originPanelId: undefined,
                        queries: [],
                    },
                },
                templating: {
                    variables: {},
                    transaction: { uid: 'DGmvKKxZz', status: TransactionStatus.Completed },
                },
            },
            setup: function (fn) {
                setupFn = fn;
            },
        };
        beforeEach(function () { return __awaiter(_this, void 0, void 0, function () {
            var store;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        keybindingSrv.setupDashboardBindings = jest.fn();
                        setDashboardSrv({
                            setCurrent: jest.fn(),
                        });
                        setTimeSrv({
                            init: jest.fn(),
                        });
                        setupFn();
                        setEchoSrv(new Echo());
                        store = mockStore(ctx.storeState);
                        // @ts-ignore
                        return [4 /*yield*/, store.dispatch(initDashboard(ctx.args))];
                    case 1:
                        // @ts-ignore
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
        ctx.args.routeName = DashboardRoutes.New;
    });
    it('Should send action dashboardInitFetching', function () {
        expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
    });
    it('Should send action dashboardInitServices ', function () {
        expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
    });
    it('Should update location with orgId query param', function () {
        var search = locationService.getSearch();
        expect(search.get('orgId')).toBe('12');
    });
    it('Should send action dashboardInitCompleted', function () {
        expect(ctx.actions[7].type).toBe(dashboardInitCompleted.type);
        expect(ctx.actions[7].payload.title).toBe('New dashboard');
    });
    it('Should initialize services', function () {
        expect(getTimeSrv().init).toBeCalled();
        expect(getDashboardSrv().setCurrent).toBeCalled();
        expect(getDashboardQueryRunner().run).toBeCalled();
        expect(keybindingSrv.setupDashboardBindings).toBeCalled();
    });
});
describeInitScenario('Initializing home dashboard', function (ctx) {
    ctx.setup(function () {
        ctx.args.routeName = DashboardRoutes.Home;
        ctx.backendSrv.get.mockResolvedValue({
            redirectUri: '/u/123/my-home',
        });
    });
    it('Should redirect to custom home dashboard', function () {
        var location = locationService.getLocation();
        expect(location.pathname).toBe('/u/123/my-home');
    });
});
describeInitScenario('Initializing home dashboard cancelled', function (ctx) {
    ctx.setup(function () {
        ctx.args.routeName = DashboardRoutes.Home;
        ctx.backendSrv.get.mockRejectedValue({ cancelled: true });
    });
    it('Should abort init process', function () {
        expect(ctx.actions.length).toBe(1);
    });
});
describeInitScenario('Initializing existing dashboard', function (ctx) {
    var mockQueries = [
        {
            context: 'explore',
            key: 'jdasldsa98dsa9',
            refId: 'A',
            expr: 'new expr',
        },
        {
            context: 'explore',
            key: 'fdsjkfds78fd',
            refId: 'B',
        },
    ];
    ctx.setup(function () {
        ctx.storeState.user.orgId = 12;
        ctx.storeState.explore.left.originPanelId = 2;
        ctx.storeState.explore.left.queries = mockQueries;
    });
    it('Should send action dashboardInitFetching', function () {
        expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
    });
    it('Should send action dashboardInitServices ', function () {
        expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
    });
    it('Should update location with orgId query param', function () {
        var search = locationService.getSearch();
        expect(search.get('orgId')).toBe('12');
    });
    it('Should send action dashboardInitCompleted', function () {
        expect(ctx.actions[8].type).toBe(dashboardInitCompleted.type);
        expect(ctx.actions[8].payload.title).toBe('My cool dashboard');
    });
    it('Should initialize services', function () {
        expect(getTimeSrv().init).toBeCalled();
        expect(getDashboardSrv().setCurrent).toBeCalled();
        expect(getDashboardQueryRunner().run).toBeCalled();
        expect(keybindingSrv.setupDashboardBindings).toBeCalled();
    });
    it('Should initialize redux variables if newVariables is enabled', function () {
        expect(ctx.actions[2].type).toBe(variablesInitTransaction.type);
    });
});
describeInitScenario('Initializing previously canceled dashboard initialization', function (ctx) {
    ctx.setup(function () {
        ctx.storeState.dashboard.initPhase = DashboardInitPhase.Fetching;
    });
    it('Should send action dashboardInitFetching', function () {
        expect(ctx.actions[0].type).toBe(dashboardInitFetching.type);
    });
    it('Should send action dashboardInitServices ', function () {
        expect(ctx.actions[1].type).toBe(dashboardInitServices.type);
    });
    it('Should not send action dashboardInitCompleted', function () {
        var dashboardInitCompletedAction = ctx.actions.find(function (a) {
            return a.type === dashboardInitCompleted.type;
        });
        expect(dashboardInitCompletedAction).toBe(undefined);
    });
    it('Should initialize timeSrv and dashboard query runner', function () {
        expect(getTimeSrv().init).toBeCalled();
        expect(getDashboardQueryRunner().run).toBeCalled();
    });
});
//# sourceMappingURL=initDashboard.test.js.map