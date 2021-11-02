import { __awaiter, __generator } from "tslib";
import moment from 'moment'; // eslint-disable-line no-restricted-imports
// eslint-disable-next-line lodash/import-scope
import _, { isFunction } from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import { AppEvents, dateMath } from '@grafana/data';
import impressionSrv from 'app/core/services/impression_srv';
import { backendSrv } from 'app/core/services/backend_srv';
import { getDashboardSrv } from './DashboardSrv';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { appEvents } from '../../../core/core';
var DashboardLoaderSrv = /** @class */ (function () {
    function DashboardLoaderSrv() {
    }
    DashboardLoaderSrv.prototype._dashboardLoadFailed = function (title, snapshot) {
        snapshot = snapshot || false;
        return {
            meta: {
                canStar: false,
                isSnapshot: snapshot,
                canDelete: false,
                canSave: false,
                canEdit: false,
                dashboardNotFound: true,
            },
            dashboard: { title: title },
        };
    };
    DashboardLoaderSrv.prototype.loadDashboard = function (type, slug, uid) {
        var _this = this;
        var promise;
        if (type === 'script') {
            promise = this._loadScriptedDashboard(slug);
        }
        else if (type === 'snapshot') {
            promise = backendSrv.get('/api/snapshots/' + slug).catch(function () {
                return _this._dashboardLoadFailed('Snapshot not found', true);
            });
        }
        else if (type === 'ds') {
            promise = this._loadFromDatasource(slug); // explore dashboards as code
        }
        else {
            promise = backendSrv
                .getDashboardByUid(uid)
                .then(function (result) {
                if (result.meta.isFolder) {
                    appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
                    throw new Error('Dashboard not found');
                }
                return result;
            })
                .catch(function () {
                return _this._dashboardLoadFailed('Not found', true);
            });
        }
        promise.then(function (result) {
            if (result.meta.dashboardNotFound !== true) {
                impressionSrv.addDashboardImpression(result.dashboard.id);
            }
            return result;
        });
        return promise;
    };
    DashboardLoaderSrv.prototype._loadScriptedDashboard = function (file) {
        var _this = this;
        var url = 'public/dashboards/' + file.replace(/\.(?!js)/, '/') + '?' + new Date().getTime();
        return getBackendSrv()
            .get(url)
            .then(this._executeScript.bind(this))
            .then(function (result) {
            return {
                meta: {
                    fromScript: true,
                    canDelete: false,
                    canSave: false,
                    canStar: false,
                },
                dashboard: result.data,
            };
        }, function (err) {
            console.error('Script dashboard error ' + err);
            appEvents.emit(AppEvents.alertError, [
                'Script Error',
                'Please make sure it exists and returns a valid dashboard',
            ]);
            return _this._dashboardLoadFailed('Scripted dashboard');
        });
    };
    /**
     * This is a temporary solution to load dashboards dynamically from a datasource
     * Eventually this should become a plugin type or a special handler in the dashboard
     * loading code
     */
    DashboardLoaderSrv.prototype._loadFromDatasource = function (dsid) {
        return __awaiter(this, void 0, void 0, function () {
            var ds, params, path, queryParams;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getDatasourceSrv().get(dsid)];
                    case 1:
                        ds = _a.sent();
                        if (!ds) {
                            return [2 /*return*/, Promise.reject('can not find datasource: ' + dsid)];
                        }
                        params = new URLSearchParams(window.location.search);
                        path = params.get('path');
                        if (!path) {
                            return [2 /*return*/, Promise.reject('expecting path parameter')];
                        }
                        queryParams = {};
                        params.forEach(function (value, key) {
                            queryParams[key] = value;
                        });
                        return [2 /*return*/, getBackendSrv()
                                .get("/api/datasources/" + ds.id + "/resources/" + path, queryParams)
                                .then(function (data) {
                                return {
                                    meta: {
                                        fromScript: true,
                                        canDelete: false,
                                        canSave: false,
                                        canStar: false,
                                    },
                                    dashboard: data,
                                };
                            })];
                }
            });
        });
    };
    DashboardLoaderSrv.prototype._executeScript = function (result) {
        var services = {
            dashboardSrv: getDashboardSrv(),
            datasourceSrv: getDatasourceSrv(),
        };
        var scriptFunc = new Function('ARGS', 'kbn', 'dateMath', '_', 'moment', 'window', 'document', '$', 'jQuery', 'services', result);
        var scriptResult = scriptFunc(locationService.getSearchObject(), kbn, dateMath, _, moment, window, document, $, $, services);
        // Handle async dashboard scripts
        if (isFunction(scriptResult)) {
            return new Promise(function (resolve) {
                scriptResult(function (dashboard) {
                    resolve({ data: dashboard });
                });
            });
        }
        return { data: scriptResult };
    };
    return DashboardLoaderSrv;
}());
export { DashboardLoaderSrv };
var dashboardLoaderSrv = new DashboardLoaderSrv();
export { dashboardLoaderSrv };
/** @internal
 * Used for tests only
 */
export var setDashboardLoaderSrv = function (srv) {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('dashboardLoaderSrv can be only overriden in test environment');
    }
    dashboardLoaderSrv = srv;
};
//# sourceMappingURL=DashboardLoaderSrv.js.map