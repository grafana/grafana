import * as tslib_1 from "tslib";
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import config from 'app/core/config';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
var BackendSrv = /** @class */ (function () {
    /** @ngInject */
    function BackendSrv($http, $q, $timeout, contextSrv) {
        this.$http = $http;
        this.$q = $q;
        this.$timeout = $timeout;
        this.contextSrv = contextSrv;
        this.inFlightRequests = {};
        this.HTTP_REQUEST_CANCELED = -1;
    }
    BackendSrv.prototype.get = function (url, params) {
        return this.request({ method: 'GET', url: url, params: params });
    };
    BackendSrv.prototype.delete = function (url) {
        return this.request({ method: 'DELETE', url: url });
    };
    BackendSrv.prototype.post = function (url, data) {
        return this.request({ method: 'POST', url: url, data: data });
    };
    BackendSrv.prototype.patch = function (url, data) {
        return this.request({ method: 'PATCH', url: url, data: data });
    };
    BackendSrv.prototype.put = function (url, data) {
        return this.request({ method: 'PUT', url: url, data: data });
    };
    BackendSrv.prototype.withNoBackendCache = function (callback) {
        var _this = this;
        this.noBackendCache = true;
        return callback().finally(function () {
            _this.noBackendCache = false;
        });
    };
    BackendSrv.prototype.requestErrorHandler = function (err) {
        if (err.isHandled) {
            return;
        }
        var data = err.data || { message: 'Unexpected error' };
        if (_.isString(data)) {
            data = { message: data };
        }
        if (err.status === 422) {
            appEvents.emit('alert-warning', ['Validation failed', data.message]);
            throw data;
        }
        var severity = 'error';
        if (err.status < 500) {
            severity = 'warning';
        }
        if (data.message) {
            var description = '';
            var message = data.message;
            if (message.length > 80) {
                description = message;
                message = 'Error';
            }
            appEvents.emit('alert-' + severity, [message, description]);
        }
        throw data;
    };
    BackendSrv.prototype.request = function (options) {
        var _this = this;
        options.retry = options.retry || 0;
        var requestIsLocal = !options.url.match(/^http/);
        var firstAttempt = options.retry === 0;
        if (requestIsLocal) {
            if (this.contextSrv.user && this.contextSrv.user.orgId) {
                options.headers = options.headers || {};
                options.headers['X-Grafana-Org-Id'] = this.contextSrv.user.orgId;
            }
            if (options.url.indexOf('/') === 0) {
                options.url = options.url.substring(1);
            }
        }
        return this.$http(options).then(function (results) {
            if (options.method !== 'GET') {
                if (results && results.data.message) {
                    if (options.showSuccessAlert !== false) {
                        appEvents.emit('alert-success', [results.data.message]);
                    }
                }
            }
            return results.data;
        }, function (err) {
            // handle unauthorized
            if (err.status === 401 && _this.contextSrv.user.isSignedIn && firstAttempt) {
                return _this.loginPing()
                    .then(function () {
                    options.retry = 1;
                    return _this.request(options);
                })
                    .catch(function (err) {
                    if (err.status === 401) {
                        window.location.href = config.appSubUrl + '/logout';
                        throw err;
                    }
                });
            }
            _this.$timeout(_this.requestErrorHandler.bind(_this, err), 50);
            throw err;
        });
    };
    BackendSrv.prototype.addCanceler = function (requestId, canceler) {
        if (requestId in this.inFlightRequests) {
            this.inFlightRequests[requestId].push(canceler);
        }
        else {
            this.inFlightRequests[requestId] = [canceler];
        }
    };
    BackendSrv.prototype.resolveCancelerIfExists = function (requestId) {
        var cancelers = this.inFlightRequests[requestId];
        if (!_.isUndefined(cancelers) && cancelers.length) {
            cancelers[0].resolve();
        }
    };
    BackendSrv.prototype.datasourceRequest = function (options) {
        var _this = this;
        var canceler = null;
        options.retry = options.retry || 0;
        // A requestID is provided by the datasource as a unique identifier for a
        // particular query. If the requestID exists, the promise it is keyed to
        // is canceled, canceling the previous datasource request if it is still
        // in-flight.
        var requestId = options.requestId;
        if (requestId) {
            this.resolveCancelerIfExists(requestId);
            // create new canceler
            canceler = this.$q.defer();
            options.timeout = canceler.promise;
            this.addCanceler(requestId, canceler);
        }
        var requestIsLocal = !options.url.match(/^http/);
        var firstAttempt = options.retry === 0;
        if (requestIsLocal) {
            if (this.contextSrv.user && this.contextSrv.user.orgId) {
                options.headers = options.headers || {};
                options.headers['X-Grafana-Org-Id'] = this.contextSrv.user.orgId;
            }
            if (options.url.indexOf('/') === 0) {
                options.url = options.url.substring(1);
            }
            if (options.headers && options.headers.Authorization) {
                options.headers['X-DS-Authorization'] = options.headers.Authorization;
                delete options.headers.Authorization;
            }
            if (this.noBackendCache) {
                options.headers['X-Grafana-NoCache'] = 'true';
            }
        }
        return this.$http(options)
            .then(function (response) {
            if (!options.silent) {
                appEvents.emit('ds-request-response', response);
            }
            return response;
        })
            .catch(function (err) {
            if (err.status === _this.HTTP_REQUEST_CANCELED) {
                throw { err: err, cancelled: true };
            }
            // handle unauthorized for backend requests
            if (requestIsLocal && firstAttempt && err.status === 401) {
                return _this.loginPing()
                    .then(function () {
                    options.retry = 1;
                    if (canceler) {
                        canceler.resolve();
                    }
                    return _this.datasourceRequest(options);
                })
                    .catch(function (err) {
                    if (err.status === 401) {
                        window.location.href = config.appSubUrl + '/logout';
                        throw err;
                    }
                });
            }
            // populate error obj on Internal Error
            if (_.isString(err.data) && err.status === 500) {
                err.data = {
                    error: err.statusText,
                    response: err.data,
                };
            }
            // for Prometheus
            if (err.data && !err.data.message && _.isString(err.data.error)) {
                err.data.message = err.data.error;
            }
            if (!options.silent) {
                appEvents.emit('ds-request-error', err);
            }
            throw err;
        })
            .finally(function () {
            // clean up
            if (options.requestId) {
                _this.inFlightRequests[options.requestId].shift();
            }
        });
    };
    BackendSrv.prototype.loginPing = function () {
        return this.request({ url: '/api/login/ping', method: 'GET', retry: 1 });
    };
    BackendSrv.prototype.search = function (query) {
        return this.get('/api/search', query);
    };
    BackendSrv.prototype.getDashboardBySlug = function (slug) {
        return this.get("/api/dashboards/db/" + slug);
    };
    BackendSrv.prototype.getDashboardByUid = function (uid) {
        return this.get("/api/dashboards/uid/" + uid);
    };
    BackendSrv.prototype.getFolderByUid = function (uid) {
        return this.get("/api/folders/" + uid);
    };
    BackendSrv.prototype.saveDashboard = function (dash, options) {
        options = options || {};
        return this.post('/api/dashboards/db/', {
            dashboard: dash,
            folderId: options.folderId,
            overwrite: options.overwrite === true,
            message: options.message || '',
        });
    };
    BackendSrv.prototype.createFolder = function (payload) {
        return this.post('/api/folders', payload);
    };
    BackendSrv.prototype.deleteFolder = function (uid, showSuccessAlert) {
        return this.request({ method: 'DELETE', url: "/api/folders/" + uid, showSuccessAlert: showSuccessAlert === true });
    };
    BackendSrv.prototype.deleteDashboard = function (uid, showSuccessAlert) {
        return this.request({
            method: 'DELETE',
            url: "/api/dashboards/uid/" + uid,
            showSuccessAlert: showSuccessAlert === true,
        });
    };
    BackendSrv.prototype.deleteFoldersAndDashboards = function (folderUids, dashboardUids) {
        var e_1, _a, e_2, _b;
        var tasks = [];
        try {
            for (var folderUids_1 = tslib_1.__values(folderUids), folderUids_1_1 = folderUids_1.next(); !folderUids_1_1.done; folderUids_1_1 = folderUids_1.next()) {
                var folderUid = folderUids_1_1.value;
                tasks.push(this.createTask(this.deleteFolder.bind(this), true, folderUid, true));
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (folderUids_1_1 && !folderUids_1_1.done && (_a = folderUids_1.return)) _a.call(folderUids_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var dashboardUids_1 = tslib_1.__values(dashboardUids), dashboardUids_1_1 = dashboardUids_1.next(); !dashboardUids_1_1.done; dashboardUids_1_1 = dashboardUids_1.next()) {
                var dashboardUid = dashboardUids_1_1.value;
                tasks.push(this.createTask(this.deleteDashboard.bind(this), true, dashboardUid, true));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (dashboardUids_1_1 && !dashboardUids_1_1.done && (_b = dashboardUids_1.return)) _b.call(dashboardUids_1);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return this.executeInOrder(tasks, []);
    };
    BackendSrv.prototype.moveDashboards = function (dashboardUids, toFolder) {
        var e_3, _a;
        var tasks = [];
        try {
            for (var dashboardUids_2 = tslib_1.__values(dashboardUids), dashboardUids_2_1 = dashboardUids_2.next(); !dashboardUids_2_1.done; dashboardUids_2_1 = dashboardUids_2.next()) {
                var uid = dashboardUids_2_1.value;
                tasks.push(this.createTask(this.moveDashboard.bind(this), true, uid, toFolder));
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (dashboardUids_2_1 && !dashboardUids_2_1.done && (_a = dashboardUids_2.return)) _a.call(dashboardUids_2);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return this.executeInOrder(tasks, []).then(function (result) {
            return {
                totalCount: result.length,
                successCount: _.filter(result, { succeeded: true }).length,
                alreadyInFolderCount: _.filter(result, { alreadyInFolder: true }).length,
            };
        });
    };
    BackendSrv.prototype.moveDashboard = function (uid, toFolder) {
        var _this = this;
        var deferred = this.$q.defer();
        this.getDashboardByUid(uid).then(function (fullDash) {
            var model = new DashboardModel(fullDash.dashboard, fullDash.meta);
            if ((!fullDash.meta.folderId && toFolder.id === 0) || fullDash.meta.folderId === toFolder.id) {
                deferred.resolve({ alreadyInFolder: true });
                return;
            }
            var clone = model.getSaveModelClone();
            var options = {
                folderId: toFolder.id,
                overwrite: false,
            };
            _this.saveDashboard(clone, options)
                .then(function () {
                deferred.resolve({ succeeded: true });
            })
                .catch(function (err) {
                if (err.data && err.data.status === 'plugin-dashboard') {
                    err.isHandled = true;
                    options.overwrite = true;
                    _this.saveDashboard(clone, options)
                        .then(function () {
                        deferred.resolve({ succeeded: true });
                    })
                        .catch(function (err) {
                        deferred.resolve({ succeeded: false });
                    });
                }
                else {
                    deferred.resolve({ succeeded: false });
                }
            });
        });
        return deferred.promise;
    };
    BackendSrv.prototype.createTask = function (fn, ignoreRejections) {
        var args = [];
        for (var _i = 2; _i < arguments.length; _i++) {
            args[_i - 2] = arguments[_i];
        }
        return function (result) {
            return fn
                .apply(null, args)
                .then(function (res) {
                return Array.prototype.concat(result, [res]);
            })
                .catch(function (err) {
                if (ignoreRejections) {
                    return result;
                }
                throw err;
            });
        };
    };
    BackendSrv.prototype.executeInOrder = function (tasks, initialValue) {
        return tasks.reduce(this.$q.when, initialValue);
    };
    return BackendSrv;
}());
export { BackendSrv };
coreModule.service('backendSrv', BackendSrv);
//
// Code below is to expore the service to react components
//
var singletonInstance;
export function setBackendSrv(instance) {
    singletonInstance = instance;
}
export function getBackendSrv() {
    return singletonInstance;
}
//# sourceMappingURL=backend_srv.js.map