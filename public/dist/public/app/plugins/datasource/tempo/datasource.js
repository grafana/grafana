import { __assign, __awaiter, __extends, __generator, __read, __spreadArray, __values } from "tslib";
import { from, merge, of, throwError } from 'rxjs';
import { catchError, map, mergeMap, toArray } from 'rxjs/operators';
import { isValidGoDuration, LoadingState, } from '@grafana/data';
import { DataSourceWithBackend, getBackendSrv } from '@grafana/runtime';
import { serializeParams } from 'app/core/utils/fetch';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { identity, pick, pickBy, groupBy, startCase } from 'lodash';
import Prism from 'prismjs';
import { mapPromMetricsToServiceMap, serviceMapMetrics } from './graphTransform';
import { transformTrace, transformTraceList, transformFromOTLP as transformFromOTEL, createTableFrameFromSearch, } from './resultTransformer';
import { tokenizer } from './syntax';
export var DEFAULT_LIMIT = 20;
var TempoDatasource = /** @class */ (function (_super) {
    __extends(TempoDatasource, _super);
    function TempoDatasource(instanceSettings) {
        var _this = _super.call(this, instanceSettings) || this;
        _this.instanceSettings = instanceSettings;
        _this.uploadedJson = null;
        _this.tracesToLogs = instanceSettings.jsonData.tracesToLogs;
        _this.serviceMap = instanceSettings.jsonData.serviceMap;
        _this.search = instanceSettings.jsonData.search;
        _this.nodeGraph = instanceSettings.jsonData.nodeGraph;
        return _this;
    }
    TempoDatasource.prototype.query = function (options) {
        var _this = this;
        var _a, _b, _c, _d, _e, _f, _g, _h;
        var subQueries = [];
        var filteredTargets = options.targets.filter(function (target) { return !target.hide; });
        var targets = groupBy(filteredTargets, function (t) { return t.queryType || 'traceId'; });
        // Run search queries on linked datasource
        if (((_a = this.tracesToLogs) === null || _a === void 0 ? void 0 : _a.datasourceUid) && ((_b = targets.search) === null || _b === void 0 ? void 0 : _b.length) > 0) {
            var dsSrv = getDatasourceSrv();
            subQueries.push(from(dsSrv.get(this.tracesToLogs.datasourceUid)).pipe(mergeMap(function (linkedDatasource) {
                var _a;
                // Wrap linked query into a data request based on original request
                var linkedRequest = __assign(__assign({}, options), { targets: targets.search.map(function (t) { return t.linkedQuery; }) });
                // Find trace matchers in derived fields of the linked datasource that's identical to this datasource
                var settings = linkedDatasource.instanceSettings;
                var traceLinkMatcher = ((_a = settings.jsonData.derivedFields) === null || _a === void 0 ? void 0 : _a.filter(function (field) { return field.datasourceUid === _this.uid && field.matcherRegex; }).map(function (field) { return field.matcherRegex; })) || [];
                if (!traceLinkMatcher || traceLinkMatcher.length === 0) {
                    return throwError(function () {
                        return new Error('No Loki datasource configured for search. Set up Derived Fields for traces in a Loki datasource settings and link it to this Tempo datasource.');
                    });
                }
                else {
                    return linkedDatasource.query(linkedRequest).pipe(map(function (response) {
                        return response.error ? response : transformTraceList(response, _this.uid, _this.name, traceLinkMatcher);
                    }));
                }
            })));
        }
        if ((_c = targets.nativeSearch) === null || _c === void 0 ? void 0 : _c.length) {
            try {
                var searchQuery = this.buildSearchQuery(targets.nativeSearch[0]);
                subQueries.push(this._request('/api/search', searchQuery).pipe(map(function (response) {
                    return {
                        data: [createTableFrameFromSearch(response.data.traces, _this.instanceSettings)],
                    };
                }), catchError(function (error) {
                    return of({ error: { message: error.data.message }, data: [] });
                })));
            }
            catch (error) {
                return of({ error: { message: error.message }, data: [] });
            }
        }
        if ((_d = targets.upload) === null || _d === void 0 ? void 0 : _d.length) {
            if (this.uploadedJson) {
                var otelTraceData = JSON.parse(this.uploadedJson);
                if (!otelTraceData.batches) {
                    subQueries.push(of({ error: { message: 'JSON is not valid OpenTelemetry format' }, data: [] }));
                }
                else {
                    subQueries.push(of(transformFromOTEL(otelTraceData.batches, (_e = this.nodeGraph) === null || _e === void 0 ? void 0 : _e.enabled)));
                }
            }
            else {
                subQueries.push(of({ data: [], state: LoadingState.Done }));
            }
        }
        if (((_f = this.serviceMap) === null || _f === void 0 ? void 0 : _f.datasourceUid) && ((_g = targets.serviceMap) === null || _g === void 0 ? void 0 : _g.length) > 0) {
            subQueries.push(serviceMapQuery(options, this.serviceMap.datasourceUid));
        }
        if (((_h = targets.traceId) === null || _h === void 0 ? void 0 : _h.length) > 0) {
            var traceRequest = __assign(__assign({}, options), { targets: targets.traceId });
            subQueries.push(_super.prototype.query.call(this, traceRequest).pipe(map(function (response) {
                var _a;
                if (response.error) {
                    return response;
                }
                return transformTrace(response, (_a = _this.nodeGraph) === null || _a === void 0 ? void 0 : _a.enabled);
            })));
        }
        return merge.apply(void 0, __spreadArray([], __read(subQueries), false));
    };
    TempoDatasource.prototype.metadataRequest = function (url, params) {
        if (params === void 0) { params = {}; }
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._request(url, params, { method: 'GET', hideFromInspector: true }).toPromise()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    TempoDatasource.prototype._request = function (apiUrl, data, options) {
        var params = data ? serializeParams(data) : '';
        var url = "" + this.instanceSettings.url + apiUrl + (params.length ? "?" + params : '');
        var req = __assign(__assign({}, options), { url: url });
        return getBackendSrv().fetch(req);
    };
    TempoDatasource.prototype.testDatasource = function () {
        return __awaiter(this, void 0, void 0, function () {
            var options, response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        options = {
                            headers: {},
                            method: 'GET',
                            url: this.instanceSettings.url + "/api/echo",
                        };
                        return [4 /*yield*/, getBackendSrv().fetch(options).toPromise()];
                    case 1:
                        response = _a.sent();
                        if (response === null || response === void 0 ? void 0 : response.ok) {
                            return [2 /*return*/, { status: 'success', message: 'Data source is working' }];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    TempoDatasource.prototype.getQueryDisplayText = function (query) {
        var e_1, _a;
        if (query.queryType === 'nativeSearch') {
            var result = [];
            try {
                for (var _b = __values(['serviceName', 'spanName', 'search', 'minDuration', 'maxDuration', 'limit']), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var key = _c.value;
                    if (query.hasOwnProperty(key) && query[key]) {
                        result.push(startCase(key) + ": " + query[key]);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            return result.join(', ');
        }
        return query.query;
    };
    TempoDatasource.prototype.buildSearchQuery = function (query) {
        var _a, _b, _c;
        var tokens = query.search ? Prism.tokenize(query.search, tokenizer) : [];
        // Build key value pairs
        var tagsQuery = [];
        for (var i = 0; i < tokens.length - 1; i++) {
            var token = tokens[i];
            var lookupToken = tokens[i + 2];
            // Ensure there is a valid key value pair with accurate types
            if (token &&
                lookupToken &&
                typeof token !== 'string' &&
                token.type === 'key' &&
                typeof token.content === 'string' &&
                typeof lookupToken !== 'string' &&
                lookupToken.type === 'value' &&
                typeof lookupToken.content === 'string') {
                tagsQuery.push((_a = {}, _a[token.content] = lookupToken.content, _a));
            }
        }
        var tempoQuery = pick(query, ['minDuration', 'maxDuration', 'limit']);
        // Remove empty properties
        tempoQuery = pickBy(tempoQuery, identity);
        if (query.serviceName) {
            tagsQuery.push((_b = {}, _b['service.name'] = query.serviceName, _b));
        }
        if (query.spanName) {
            tagsQuery.push((_c = {}, _c['name'] = query.spanName, _c));
        }
        // Set default limit
        if (!tempoQuery.limit) {
            tempoQuery.limit = DEFAULT_LIMIT;
        }
        // Validate query inputs and remove spaces if valid
        if (tempoQuery.minDuration) {
            if (!isValidGoDuration(tempoQuery.minDuration)) {
                throw new Error('Please enter a valid min duration.');
            }
            tempoQuery.minDuration = tempoQuery.minDuration.replace(/\s/g, '');
        }
        if (tempoQuery.maxDuration) {
            if (!isValidGoDuration(tempoQuery.maxDuration)) {
                throw new Error('Please enter a valid max duration.');
            }
            tempoQuery.maxDuration = tempoQuery.maxDuration.replace(/\s/g, '');
        }
        if (!Number.isInteger(tempoQuery.limit) || tempoQuery.limit <= 0) {
            throw new Error('Please enter a valid limit.');
        }
        var tagsQueryObject = tagsQuery.reduce(function (tagQuery, item) { return (__assign(__assign({}, tagQuery), item)); }, {});
        return __assign(__assign({}, tagsQueryObject), tempoQuery);
    };
    return TempoDatasource;
}(DataSourceWithBackend));
export { TempoDatasource };
function queryServiceMapPrometheus(request, datasourceUid) {
    return from(getDatasourceSrv().get(datasourceUid)).pipe(mergeMap(function (ds) {
        return ds.query(request);
    }));
}
function serviceMapQuery(request, datasourceUid) {
    return queryServiceMapPrometheus(makePromServiceMapRequest(request), datasourceUid).pipe(
    // Just collect all the responses first before processing into node graph data
    toArray(), map(function (responses) {
        var errorRes = responses.find(function (res) { return !!res.error; });
        if (errorRes) {
            throw new Error(errorRes.error.message);
        }
        return {
            data: mapPromMetricsToServiceMap(responses, request.range),
            state: LoadingState.Done,
        };
    }));
}
function makePromServiceMapRequest(options) {
    return __assign(__assign({}, options), { targets: serviceMapMetrics.map(function (metric) {
            return {
                refId: metric,
                expr: "delta(" + metric + "[$__range])",
                instant: true,
            };
        }) });
}
//# sourceMappingURL=datasource.js.map