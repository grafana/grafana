import { __assign, __awaiter, __generator } from "tslib";
// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { dashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { keybindingSrv } from 'app/core/services/keybindingSrv';
// Actions
import { notifyApp } from 'app/core/actions';
import { clearDashboardQueriesToUpdateOnLoad, dashboardInitCompleted, dashboardInitFailed, dashboardInitFetching, dashboardInitServices, dashboardInitSlow, } from './reducers';
// Types
import { DashboardInitPhase, DashboardRoutes } from 'app/types';
import { DashboardModel } from './DashboardModel';
import { locationUtil, setWeekStart } from '@grafana/data';
import { initVariablesTransaction } from '../../variables/state/actions';
import { emitDashboardViewEvent } from './analyticsProcessor';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { config, locationService } from '@grafana/runtime';
import { createDashboardQueryRunner } from '../../query/state/DashboardQueryRunner/DashboardQueryRunner';
function fetchDashboard(args, dispatch, getState) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, dashDTO, newUrl, dashDTO, dashboardUrl, currentPath, err_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 8, , 9]);
                    _a = args.routeName;
                    switch (_a) {
                        case DashboardRoutes.Home: return [3 /*break*/, 1];
                        case DashboardRoutes.Normal: return [3 /*break*/, 3];
                        case DashboardRoutes.New: return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 6];
                case 1: return [4 /*yield*/, backendSrv.get('/api/dashboards/home')];
                case 2:
                    dashDTO = _b.sent();
                    // if user specified a custom home dashboard redirect to that
                    if (dashDTO.redirectUri) {
                        newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
                        locationService.replace(newUrl);
                        return [2 /*return*/, null];
                    }
                    // disable some actions on the default home dashboard
                    dashDTO.meta.canSave = false;
                    dashDTO.meta.canShare = false;
                    dashDTO.meta.canStar = false;
                    return [2 /*return*/, dashDTO];
                case 3: return [4 /*yield*/, dashboardLoaderSrv.loadDashboard(args.urlType, args.urlSlug, args.urlUid)];
                case 4:
                    dashDTO = _b.sent();
                    if (args.fixUrl && dashDTO.meta.url) {
                        dashboardUrl = locationUtil.stripBaseFromUrl(dashDTO.meta.url);
                        currentPath = locationService.getLocation().pathname;
                        if (dashboardUrl !== currentPath) {
                            // Spread current location to persist search params used for navigation
                            locationService.replace(__assign(__assign({}, locationService.getLocation()), { pathname: dashboardUrl }));
                            console.log('not correct url correcting', dashboardUrl, currentPath);
                        }
                    }
                    return [2 /*return*/, dashDTO];
                case 5:
                    {
                        return [2 /*return*/, getNewDashboardModelData(args.urlFolderId)];
                    }
                    _b.label = 6;
                case 6: throw { message: 'Unknown route ' + args.routeName };
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_1 = _b.sent();
                    // Ignore cancelled errors
                    if (err_1.cancelled) {
                        return [2 /*return*/, null];
                    }
                    dispatch(dashboardInitFailed({ message: 'Failed to fetch dashboard', error: err_1 }));
                    console.error(err_1);
                    return [2 /*return*/, null];
                case 9: return [2 /*return*/];
            }
        });
    });
}
/**
 * This action (or saga) does everything needed to bootstrap a dashboard & dashboard model.
 * First it handles the process of fetching the dashboard, correcting the url if required (causing redirects/url updates)
 *
 * This is used both for single dashboard & solo panel routes, home & new dashboard routes.
 *
 * Then it handles the initializing of the old angular services that the dashboard components & panels still depend on
 *
 */
export function initDashboard(args) {
    var _this = this;
    return function (dispatch, getState) { return __awaiter(_this, void 0, void 0, function () {
        var dashDTO, dashboard, storeState, queryParams, timeSrv, dashboardSrv, _a, panelId, queries, runner, _b, panelId, queries;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    // set fetching state
                    dispatch(dashboardInitFetching());
                    // Detect slow loading / initializing and set state flag
                    // This is in order to not show loading indication for fast loading dashboards as it creates blinking/flashing
                    setTimeout(function () {
                        if (getState().dashboard.getModel() === null) {
                            dispatch(dashboardInitSlow());
                        }
                    }, 500);
                    return [4 /*yield*/, fetchDashboard(args, dispatch, getState)];
                case 1:
                    dashDTO = _c.sent();
                    // returns null if there was a redirect or error
                    if (!dashDTO) {
                        return [2 /*return*/];
                    }
                    // set initializing state
                    dispatch(dashboardInitServices());
                    try {
                        dashboard = new DashboardModel(dashDTO.dashboard, dashDTO.meta);
                    }
                    catch (err) {
                        dispatch(dashboardInitFailed({ message: 'Failed create dashboard model', error: err }));
                        console.error(err);
                        return [2 /*return*/];
                    }
                    storeState = getState();
                    queryParams = locationService.getSearchObject();
                    if (!queryParams.orgId) {
                        // TODO this is currently not possible with the LocationService API
                        locationService.partial({ orgId: storeState.user.orgId }, true);
                    }
                    timeSrv = getTimeSrv();
                    dashboardSrv = getDashboardSrv();
                    // legacy srv state, we need this value updated for built-in annotations
                    dashboardSrv.setCurrent(dashboard);
                    timeSrv.init(dashboard);
                    if (storeState.dashboard.modifiedQueries) {
                        _a = storeState.dashboard.modifiedQueries, panelId = _a.panelId, queries = _a.queries;
                        dashboard.meta.fromExplore = !!(panelId && queries);
                    }
                    // template values service needs to initialize completely before the rest of the dashboard can load
                    return [4 /*yield*/, dispatch(initVariablesTransaction(args.urlUid, dashboard))];
                case 2:
                    // template values service needs to initialize completely before the rest of the dashboard can load
                    _c.sent();
                    runner = createDashboardQueryRunner({ dashboard: dashboard, timeSrv: timeSrv });
                    runner.run({ dashboard: dashboard, range: timeSrv.timeRange() });
                    if (getState().templating.transaction.uid !== args.urlUid) {
                        // if a previous dashboard has slow running variable queries the batch uid will be the new one
                        // but the args.urlUid will be the same as before initVariablesTransaction was called so then we can't continue initializing
                        // the previous dashboard.
                        return [2 /*return*/];
                    }
                    // If dashboard is in a different init phase it means it cancelled during service init
                    if (getState().dashboard.initPhase !== DashboardInitPhase.Services) {
                        return [2 /*return*/];
                    }
                    try {
                        dashboard.processRepeats();
                        // handle auto fix experimental feature
                        if (queryParams.autofitpanels) {
                            dashboard.autoFitPanels(window.innerHeight, queryParams.kiosk);
                        }
                        keybindingSrv.setupDashboardBindings(dashboard);
                    }
                    catch (err) {
                        dispatch(notifyApp(createErrorNotification('Dashboard init failed', err)));
                        console.error(err);
                    }
                    if (storeState.dashboard.modifiedQueries) {
                        _b = storeState.dashboard.modifiedQueries, panelId = _b.panelId, queries = _b.queries;
                        updateQueriesWhenComingFromExplore(dispatch, dashboard, panelId, queries);
                    }
                    // send open dashboard event
                    if (args.routeName !== DashboardRoutes.New) {
                        emitDashboardViewEvent(dashboard);
                        // Listen for changes on the current dashboard
                        dashboardWatcher.watch(dashboard.uid);
                    }
                    else {
                        dashboardWatcher.leave();
                    }
                    // set week start
                    if (dashboard.weekStart !== '') {
                        setWeekStart(dashboard.weekStart);
                    }
                    else {
                        setWeekStart(config.bootData.user.weekStart);
                    }
                    // yay we are done
                    dispatch(dashboardInitCompleted(dashboard));
                    return [2 /*return*/];
            }
        });
    }); };
}
function getNewDashboardModelData(urlFolderId) {
    var data = {
        meta: {
            canStar: false,
            canShare: false,
            isNew: true,
            folderId: 0,
        },
        dashboard: {
            title: 'New dashboard',
            panels: [
                {
                    type: 'add-panel',
                    gridPos: { x: 0, y: 0, w: 12, h: 9 },
                    title: 'Panel Title',
                },
            ],
        },
    };
    if (urlFolderId) {
        data.meta.folderId = parseInt(urlFolderId, 10);
    }
    return data;
}
function updateQueriesWhenComingFromExplore(dispatch, dashboard, originPanelId, queries) {
    var panelArrId = dashboard.panels.findIndex(function (panel) { return panel.id === originPanelId; });
    if (panelArrId > -1) {
        dashboard.panels[panelArrId].targets = queries;
    }
    // Clear update state now that we're done
    dispatch(clearDashboardQueriesToUpdateOnLoad());
}
//# sourceMappingURL=initDashboard.js.map