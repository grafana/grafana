import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';
import $ from 'jquery';
import kbn from 'app/core/utils/kbn';
import * as dateMath from 'app/core/utils/datemath';
import impressionSrv from 'app/core/services/impression_srv';
var DashboardLoaderSrv = /** @class */ (function () {
    /** @ngInject */
    function DashboardLoaderSrv(backendSrv, dashboardSrv, datasourceSrv, $http, $q, $timeout, contextSrv, $routeParams, $rootScope) {
        this.backendSrv = backendSrv;
        this.dashboardSrv = dashboardSrv;
        this.datasourceSrv = datasourceSrv;
        this.$http = $http;
        this.$q = $q;
        this.$timeout = $timeout;
        this.$routeParams = $routeParams;
        this.$rootScope = $rootScope;
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
            promise = this.backendSrv.get('/api/snapshots/' + slug).catch(function () {
                return _this._dashboardLoadFailed('Snapshot not found', true);
            });
        }
        else {
            promise = this.backendSrv
                .getDashboardByUid(uid)
                .then(function (result) {
                if (result.meta.isFolder) {
                    _this.$rootScope.appEvent('alert-error', ['Dashboard not found']);
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
        return this.$http({ url: url, method: 'GET' })
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
            console.log('Script dashboard error ' + err);
            _this.$rootScope.appEvent('alert-error', [
                'Script Error',
                'Please make sure it exists and returns a valid dashboard',
            ]);
            return _this._dashboardLoadFailed('Scripted dashboard');
        });
    };
    DashboardLoaderSrv.prototype._executeScript = function (result) {
        var _this = this;
        var services = {
            dashboardSrv: this.dashboardSrv,
            datasourceSrv: this.datasourceSrv,
            $q: this.$q,
        };
        /*jshint -W054 */
        var scriptFunc = new Function('ARGS', 'kbn', 'dateMath', '_', 'moment', 'window', 'document', '$', 'jQuery', 'services', result.data);
        var scriptResult = scriptFunc(this.$routeParams, kbn, dateMath, _, moment, window, document, $, $, services);
        // Handle async dashboard scripts
        if (_.isFunction(scriptResult)) {
            var deferred_1 = this.$q.defer();
            scriptResult(function (dashboard) {
                _this.$timeout(function () {
                    deferred_1.resolve({ data: dashboard });
                });
            });
            return deferred_1.promise;
        }
        return { data: scriptResult };
    };
    return DashboardLoaderSrv;
}());
export { DashboardLoaderSrv };
angular.module('grafana.services').service('dashboardLoaderSrv', DashboardLoaderSrv);
//# sourceMappingURL=DashboardLoaderSrv.js.map