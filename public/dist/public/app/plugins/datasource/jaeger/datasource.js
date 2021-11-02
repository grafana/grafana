import { __assign, __awaiter, __extends, __generator, __read, __spreadArray } from "tslib";
import { identity, omit, pick, pickBy } from 'lodash';
import { lastValueFrom, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { DataSourceApi, dateMath, FieldType, MutableDataFrame, } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { serializeParams } from 'app/core/utils/fetch';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { createTableFrame, createTraceFrame } from './responseTransform';
import { createGraphFrames } from './graphTransform';
import { convertTagsLogfmt } from './util';
import { ALL_OPERATIONS_KEY } from './components/SearchForm';
var JaegerDatasource = /** @class */ (function (_super) {
    __extends(JaegerDatasource, _super);
    function JaegerDatasource(instanceSettings, timeSrv) {
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.timeSrv = timeSrv;
        _this.uploadedJson = null;
        _this.nodeGraph = instanceSettings.jsonData.nodeGraph;
        return _this;
    }
    JaegerDatasource.prototype.metadataRequest = function (url, params) {
        return __awaiter(this, void 0, void 0, function () {
            var res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, lastValueFrom(this._request(url, params, { hideFromInspector: true }))];
                    case 1:
                        res = _a.sent();
                        return [2 /*return*/, res.data.data];
                }
            });
        });
    };
    JaegerDatasource.prototype.query = function (options) {
        var _this = this;
        var _a;
        // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
        // traces at one we need to change this.
        var target = options.targets[0];
        if (!target) {
            return of({ data: [emptyTraceDataFrame] });
        }
        if (target.queryType !== 'search' && target.query) {
            return this._request("/api/traces/" + encodeURIComponent(target.query)).pipe(map(function (response) {
                var _a, _b, _c;
                var traceData = (_b = (_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b[0];
                if (!traceData) {
                    return { data: [emptyTraceDataFrame] };
                }
                var data = [createTraceFrame(traceData)];
                if ((_c = _this.nodeGraph) === null || _c === void 0 ? void 0 : _c.enabled) {
                    data.push.apply(data, __spreadArray([], __read(createGraphFrames(traceData)), false));
                }
                return {
                    data: data,
                };
            }));
        }
        if (target.queryType === 'upload') {
            if (!this.uploadedJson) {
                return of({ data: [] });
            }
            try {
                var traceData = JSON.parse(this.uploadedJson).data[0];
                var data = [createTraceFrame(traceData)];
                if ((_a = this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled) {
                    data.push.apply(data, __spreadArray([], __read(createGraphFrames(traceData)), false));
                }
                return of({ data: data });
            }
            catch (error) {
                return of({ error: { message: 'JSON is not valid Jaeger format' }, data: [] });
            }
        }
        var jaegerQuery = pick(target, ['operation', 'service', 'tags', 'minDuration', 'maxDuration', 'limit']);
        // remove empty properties
        jaegerQuery = pickBy(jaegerQuery, identity);
        if (jaegerQuery.tags) {
            jaegerQuery = __assign(__assign({}, jaegerQuery), { tags: convertTagsLogfmt(jaegerQuery.tags) });
        }
        if (jaegerQuery.operation === ALL_OPERATIONS_KEY) {
            jaegerQuery = omit(jaegerQuery, 'operation');
        }
        // TODO: this api is internal, used in jaeger ui. Officially they have gRPC api that should be used.
        return this._request("/api/traces", __assign(__assign(__assign({}, jaegerQuery), this.getTimeRange()), { lookback: 'custom' })).pipe(map(function (response) {
            return {
                data: [createTableFrame(response.data.data, _this.instanceSettings)],
            };
        }));
    };
    JaegerDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, lastValueFrom(this._request('/api/services').pipe(map(function (res) {
                        var _a;
                        var values = ((_a = res === null || res === void 0 ? void 0 : res.data) === null || _a === void 0 ? void 0 : _a.data) || [];
                        var testResult = values.length > 0
                            ? { status: 'success', message: 'Data source connected and services found.' }
                            : {
                                status: 'error',
                                message: 'Data source connected, but no services received. Verify that Jaeger is configured properly.',
                            };
                        return testResult;
                    }), catchError(function (err) {
                        var message = 'Jaeger: ';
                        if (err.statusText) {
                            message += err.statusText;
                        }
                        else {
                            message += 'Cannot connect to Jaeger';
                        }
                        if (err.status) {
                            message += ". " + err.status;
                        }
                        if (err.data && err.data.message) {
                            message += ". " + err.data.message;
                        }
                        else if (err.data) {
                            message += ". " + JSON.stringify(err.data);
                        }
                        return of({ status: 'error', message: message });
                    })))];
            });
        });
    };
    JaegerDatasource.prototype.getTimeRange = function () {
        var range = this.timeSrv.timeRange();
        return {
            start: getTime(range.from, false),
            end: getTime(range.to, true),
        };
    };
    JaegerDatasource.prototype.getQueryDisplayText = function (query) {
        return query.query || '';
    };
    JaegerDatasource.prototype._request = function (apiUrl, data, options) {
        var params = data ? serializeParams(data) : '';
        var url = "" + this.instanceSettings.url + apiUrl + (params.length ? "?" + params : '');
        var req = __assign(__assign({}, options), { url: url });
        return getBackendSrv().fetch(req);
    };
    return JaegerDatasource;
}(DataSourceApi));
export { JaegerDatasource };
function getTime(date, roundUp) {
    if (typeof date === 'string') {
        date = dateMath.parse(date, roundUp);
    }
    return date.valueOf() * 1000;
}
var emptyTraceDataFrame = new MutableDataFrame({
    fields: [
        {
            name: 'trace',
            type: FieldType.trace,
            values: [],
        },
    ],
    meta: {
        preferredVisualisationType: 'trace',
        custom: {
            traceFormat: 'jaeger',
        },
    },
});
//# sourceMappingURL=datasource.js.map