import * as tslib_1 from "tslib";
// Services & Utils
import { createErrorNotification } from 'app/core/copy/appNotification';
import { getBackendSrv } from 'app/core/services/backend_srv';
// Actions
import { updateLocation } from 'app/core/actions';
import { notifyApp } from 'app/core/actions';
import locationUtil from 'app/core/utils/location_util';
import { dashboardInitFetching, dashboardInitCompleted, dashboardInitFailed, dashboardInitSlow, dashboardInitServices, } from './actions';
// Types
import { DashboardRouteInfo } from 'app/types';
import { DashboardModel } from './DashboardModel';
function redirectToNewUrl(slug, dispatch, currentPath) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var res, newUrl, url;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getBackendSrv().getDashboardBySlug(slug)];
                case 1:
                    res = _a.sent();
                    if (res) {
                        newUrl = res.meta.url;
                        // fix solo route urls
                        if (currentPath.indexOf('dashboard-solo') !== -1) {
                            newUrl = newUrl.replace('/d/', '/d-solo/');
                        }
                        url = locationUtil.stripBaseFromUrl(newUrl);
                        dispatch(updateLocation({ path: url, partial: true, replace: true }));
                    }
                    return [2 /*return*/];
            }
        });
    });
}
function fetchDashboard(args, dispatch, getState) {
    return tslib_1.__awaiter(this, void 0, void 0, function () {
        var _a, dashDTO, newUrl, loaderSrv, dashDTO, dashboardUrl, currentPath, err_1;
        return tslib_1.__generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 8, , 9]);
                    _a = args.routeInfo;
                    switch (_a) {
                        case DashboardRouteInfo.Home: return [3 /*break*/, 1];
                        case DashboardRouteInfo.Normal: return [3 /*break*/, 3];
                        case DashboardRouteInfo.New: return [3 /*break*/, 5];
                    }
                    return [3 /*break*/, 6];
                case 1: return [4 /*yield*/, getBackendSrv().get('/api/dashboards/home')];
                case 2:
                    dashDTO = _b.sent();
                    // if user specified a custom home dashboard redirect to that
                    if (dashDTO.redirectUri) {
                        newUrl = locationUtil.stripBaseFromUrl(dashDTO.redirectUri);
                        dispatch(updateLocation({ path: newUrl, replace: true }));
                        return [2 /*return*/, null];
                    }
                    // disable some actions on the default home dashboard
                    dashDTO.meta.canSave = false;
                    dashDTO.meta.canShare = false;
                    dashDTO.meta.canStar = false;
                    return [2 /*return*/, dashDTO];
                case 3:
                    // for old db routes we redirect
                    if (args.urlType === 'db') {
                        redirectToNewUrl(args.urlSlug, dispatch, getState().location.path);
                        return [2 /*return*/, null];
                    }
                    loaderSrv = args.$injector.get('dashboardLoaderSrv');
                    return [4 /*yield*/, loaderSrv.loadDashboard(args.urlType, args.urlSlug, args.urlUid)];
                case 4:
                    dashDTO = _b.sent();
                    if (args.fixUrl && dashDTO.meta.url) {
                        dashboardUrl = locationUtil.stripBaseFromUrl(dashDTO.meta.url);
                        currentPath = getState().location.path;
                        if (dashboardUrl !== currentPath) {
                            // replace url to not create additional history items and then return so that initDashboard below isn't executed multiple times.
                            dispatch(updateLocation({ path: dashboardUrl, partial: true, replace: true }));
                            return [2 /*return*/, null];
                        }
                    }
                    return [2 /*return*/, dashDTO];
                case 5:
                    {
                        return [2 /*return*/, getNewDashboardModelData(args.urlFolderId)];
                    }
                    _b.label = 6;
                case 6: throw { message: 'Unknown route ' + args.routeInfo };
                case 7: return [3 /*break*/, 9];
                case 8:
                    err_1 = _b.sent();
                    dispatch(dashboardInitFailed({ message: 'Failed to fetch dashboard', error: err_1 }));
                    console.log(err_1);
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
    return function (dispatch, getState) { return tslib_1.__awaiter(_this, void 0, void 0, function () {
        var dashDTO, dashboard, storeState, timeSrv, annotationsSrv, variableSrv, keybindingSrv, unsavedChangesSrv, dashboardSrv, err_2, queryParams;
        return tslib_1.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    // set fetching state
                    dispatch(dashboardInitFetching());
                    // Detect slow loading / initializing and set state flag
                    // This is in order to not show loading indication for fast loading dashboards as it creates blinking/flashing
                    setTimeout(function () {
                        if (getState().dashboard.model === null) {
                            dispatch(dashboardInitSlow());
                        }
                    }, 500);
                    return [4 /*yield*/, fetchDashboard(args, dispatch, getState)];
                case 1:
                    dashDTO = _a.sent();
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
                        console.log(err);
                        return [2 /*return*/];
                    }
                    storeState = getState();
                    if (!storeState.location.query.orgId) {
                        dispatch(updateLocation({ query: { orgId: storeState.user.orgId }, partial: true, replace: true }));
                    }
                    timeSrv = args.$injector.get('timeSrv');
                    annotationsSrv = args.$injector.get('annotationsSrv');
                    variableSrv = args.$injector.get('variableSrv');
                    keybindingSrv = args.$injector.get('keybindingSrv');
                    unsavedChangesSrv = args.$injector.get('unsavedChangesSrv');
                    dashboardSrv = args.$injector.get('dashboardSrv');
                    timeSrv.init(dashboard);
                    annotationsSrv.init(dashboard);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, variableSrv.init(dashboard)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 5];
                case 4:
                    err_2 = _a.sent();
                    dispatch(notifyApp(createErrorNotification('Templating init failed', err_2)));
                    console.log(err_2);
                    return [3 /*break*/, 5];
                case 5:
                    try {
                        dashboard.processRepeats();
                        dashboard.updateSubmenuVisibility();
                        queryParams = getState().location.query;
                        if (queryParams.autofitpanels) {
                            dashboard.autoFitPanels(window.innerHeight, queryParams.kiosk);
                        }
                        // init unsaved changes tracking
                        unsavedChangesSrv.init(dashboard, args.$scope);
                        keybindingSrv.setupDashboardBindings(args.$scope, dashboard);
                    }
                    catch (err) {
                        dispatch(notifyApp(createErrorNotification('Dashboard init failed', err)));
                        console.log(err);
                    }
                    // legacy srv state
                    dashboardSrv.setCurrent(dashboard);
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
//# sourceMappingURL=initDashboard.js.map