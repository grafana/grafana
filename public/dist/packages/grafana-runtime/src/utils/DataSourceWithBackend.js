import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { DataSourceApi, makeClassES5Compatible, parseLiveChannelAddress, StreamingFrameAction, } from '@grafana/data';
import { merge, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { getBackendSrv, getDataSourceSrv, getGrafanaLiveSrv } from '../services';
import { toDataQueryResponse } from './queryResponse';
var ExpressionDatasourceID = '__expr__';
var HealthCheckError = /** @class */ (function (_super) {
    __extends(HealthCheckError, _super);
    function HealthCheckError(message, details) {
        var _this = _super.call(this, message) || this;
        _this.details = details;
        _this.name = 'HealthCheckError';
        return _this;
    }
    return HealthCheckError;
}(Error));
/**
 * Describes the current health status of a data source plugin.
 *
 * @public
 */
export var HealthStatus;
(function (HealthStatus) {
    HealthStatus["Unknown"] = "UNKNOWN";
    HealthStatus["OK"] = "OK";
    HealthStatus["Error"] = "ERROR";
})(HealthStatus || (HealthStatus = {}));
/**
 * Extend this class to implement a data source plugin that is depending on the Grafana
 * backend API.
 *
 * @public
 */
var DataSourceWithBackend = /** @class */ (function (_super) {
    __extends(DataSourceWithBackend, _super);
    function DataSourceWithBackend(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        /**
         * Optionally override the streaming behavior
         */
        _this.streamOptionsProvider = standardStreamOptionsProvider;
        return _this;
    }
    /**
     * Ideally final -- any other implementation may not work as expected
     */
    DataSourceWithBackend.prototype.query = function (request) {
        var _this = this;
        var intervalMs = request.intervalMs, maxDataPoints = request.maxDataPoints, range = request.range, requestId = request.requestId;
        var targets = request.targets;
        if (this.filterQuery) {
            targets = targets.filter(function (q) { return _this.filterQuery(q); });
        }
        var queries = targets.map(function (q) {
            var datasourceId = _this.id;
            if (q.datasource === ExpressionDatasourceID) {
                return __assign(__assign({}, q), { datasourceId: datasourceId });
            }
            if (q.datasource) {
                var ds = getDataSourceSrv().getInstanceSettings(q.datasource);
                if (!ds) {
                    throw new Error("Unknown Datasource: " + JSON.stringify(q.datasource));
                }
                datasourceId = ds.id;
            }
            return __assign(__assign({}, _this.applyTemplateVariables(q, request.scopedVars)), { datasourceId: datasourceId, intervalMs: intervalMs, maxDataPoints: maxDataPoints });
        });
        // Return early if no queries exist
        if (!queries.length) {
            return of({ data: [] });
        }
        var body = { queries: queries };
        if (range) {
            body.range = range;
            body.from = range.from.valueOf().toString();
            body.to = range.to.valueOf().toString();
        }
        return getBackendSrv()
            .fetch({
            url: '/api/ds/query',
            method: 'POST',
            data: body,
            requestId: requestId,
        })
            .pipe(switchMap(function (raw) {
            var _a;
            var rsp = toDataQueryResponse(raw, queries);
            // Check if any response should subscribe to a live stream
            if (((_a = rsp.data) === null || _a === void 0 ? void 0 : _a.length) && rsp.data.find(function (f) { var _a; return (_a = f.meta) === null || _a === void 0 ? void 0 : _a.channel; })) {
                return toStreamingDataResponse(rsp, request, _this.streamOptionsProvider);
            }
            return of(rsp);
        }), catchError(function (err) {
            return of(toDataQueryResponse(err));
        }));
    };
    /**
     * Override to apply template variables.  The result is usually also `TQuery`, but sometimes this can
     * be used to modify the query structure before sending to the backend.
     *
     * NOTE: if you do modify the structure or use template variables, alerting queries may not work
     * as expected
     *
     * @virtual
     */
    DataSourceWithBackend.prototype.applyTemplateVariables = function (query, scopedVars) {
        return query;
    };
    /**
     * Make a GET request to the datasource resource path
     */
    DataSourceWithBackend.prototype.getResource = function (path, params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, getBackendSrv().get("/api/datasources/" + this.id + "/resources/" + path, params)];
            });
        });
    };
    /**
     * Send a POST request to the datasource resource path
     */
    DataSourceWithBackend.prototype.postResource = function (path, body) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, getBackendSrv().post("/api/datasources/" + this.id + "/resources/" + path, __assign({}, body))];
            });
        });
    };
    /**
     * Run the datasource healthcheck
     */
    DataSourceWithBackend.prototype.callHealthCheck = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, getBackendSrv()
                        .request({ method: 'GET', url: "/api/datasources/" + this.id + "/health", showErrorAlert: false })
                        .then(function (v) {
                        return v;
                    })
                        .catch(function (err) {
                        return err.data;
                    })];
            });
        });
    };
    /**
     * Checks the plugin health
     * see public/app/features/datasources/state/actions.ts for what needs to be returned here
     */
    DataSourceWithBackend.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.callHealthCheck().then(function (res) {
                        if (res.status === HealthStatus.OK) {
                            return {
                                status: 'success',
                                message: res.message,
                            };
                        }
                        throw new HealthCheckError(res.message, res.details);
                    })];
            });
        });
    };
    return DataSourceWithBackend;
}(DataSourceApi));
/**
 * @internal exported for tests
 */
export function toStreamingDataResponse(rsp, req, getter) {
    var e_1, _a;
    var _b;
    var live = getGrafanaLiveSrv();
    if (!live) {
        return of(rsp); // add warning?
    }
    var staticdata = [];
    var streams = [];
    try {
        for (var _c = __values(rsp.data), _d = _c.next(); !_d.done; _d = _c.next()) {
            var f = _d.value;
            var addr = parseLiveChannelAddress((_b = f.meta) === null || _b === void 0 ? void 0 : _b.channel);
            if (addr) {
                var frame = f;
                streams.push(live.getDataStream({
                    addr: addr,
                    buffer: getter(req, frame),
                    frame: frame,
                }));
            }
            else {
                staticdata.push(f);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (staticdata.length) {
        streams.push(of(__assign(__assign({}, rsp), { data: staticdata })));
    }
    if (streams.length === 1) {
        return streams[0]; // avoid merge wrapper
    }
    return merge.apply(void 0, __spreadArray([], __read(streams), false));
}
/**
 * @public
 */
export var standardStreamOptionsProvider = function (request, frame) {
    var _a, _b;
    var buffer = {
        maxLength: (_a = request.maxDataPoints) !== null && _a !== void 0 ? _a : 500,
        action: StreamingFrameAction.Append,
    };
    // For recent queries, clamp to the current time range
    if (((_b = request.rangeRaw) === null || _b === void 0 ? void 0 : _b.to) === 'now') {
        buffer.maxDelta = request.range.to.valueOf() - request.range.from.valueOf();
    }
    return buffer;
};
//@ts-ignore
DataSourceWithBackend = makeClassES5Compatible(DataSourceWithBackend);
export { DataSourceWithBackend };
//# sourceMappingURL=DataSourceWithBackend.js.map