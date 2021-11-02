import { __assign } from "tslib";
import { lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { formatCloudMonitoringError } from './functions';
var Api = /** @class */ (function () {
    function Api(baseUrl) {
        this.baseUrl = baseUrl;
        this.cache = {};
        this.defaultOptions = {
            useCache: true,
            responseMap: function (res) { return res; },
            baseUrl: this.baseUrl,
        };
    }
    Api.prototype.get = function (path, options) {
        var _this = this;
        var _a = __assign(__assign({}, this.defaultOptions), options), useCache = _a.useCache, responseMap = _a.responseMap, baseUrl = _a.baseUrl;
        if (useCache && this.cache[path]) {
            return Promise.resolve(this.cache[path]);
        }
        return lastValueFrom(getBackendSrv()
            .fetch({
            url: baseUrl + path,
            method: 'GET',
        })
            .pipe(map(function (response) {
            var responsePropName = path.match(/([^\/]*)\/*$/)[1].split('?')[0];
            var res = [];
            if (response && response.data && response.data[responsePropName]) {
                res = response.data[responsePropName].map(responseMap);
            }
            if (useCache) {
                _this.cache[path] = res;
            }
            return res;
        }), catchError(function (error) {
            appEvents.emit(CoreEvents.dsRequestError, {
                error: { data: { error: formatCloudMonitoringError(error) } },
            });
            return of([]);
        })));
    };
    Api.prototype.post = function (data) {
        return getBackendSrv().fetch({
            url: '/api/ds/query',
            method: 'POST',
            data: data,
        });
    };
    Api.prototype.test = function (projectName) {
        return lastValueFrom(getBackendSrv().fetch({
            url: "" + this.baseUrl + projectName + "/metricDescriptors",
            method: 'GET',
        }));
    };
    return Api;
}());
export default Api;
//# sourceMappingURL=api.js.map