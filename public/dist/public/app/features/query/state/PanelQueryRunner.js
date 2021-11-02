import { __assign, __awaiter, __generator } from "tslib";
// Libraries
import { cloneDeep } from 'lodash';
import { of, ReplaySubject } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
// Services & Utils
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { preProcessPanelData, runRequest } from './runRequest';
import { isSharedDashboardQuery, runSharedRequest } from '../../../plugins/datasource/dashboard';
// Types
import { applyFieldOverrides, compareArrayValues, compareDataFrameStructures, CoreApp, LoadingState, rangeUtil, transformDataFrame, } from '@grafana/data';
import { getDashboardQueryRunner } from './DashboardQueryRunner/DashboardQueryRunner';
import { mergePanelAndDashData } from './mergePanelAndDashData';
var counter = 100;
export function getNextRequestId() {
    return 'Q' + counter++;
}
var PanelQueryRunner = /** @class */ (function () {
    function PanelQueryRunner(dataConfigSource) {
        var _this = this;
        this.getTransformationsStream = function (withTransforms) {
            return function (inputStream) {
                return inputStream.pipe(mergeMap(function (data) {
                    if (!withTransforms) {
                        return of(data);
                    }
                    var transformations = _this.dataConfigSource.getTransformations();
                    if (!transformations || transformations.length === 0) {
                        return of(data);
                    }
                    return transformDataFrame(transformations, data.series).pipe(map(function (series) { return (__assign(__assign({}, data), { series: series })); }));
                }));
            };
        };
        this.resendLastResult = function () {
            if (_this.lastResult) {
                _this.subject.next(_this.lastResult);
            }
        };
        this.subject = new ReplaySubject(1);
        this.dataConfigSource = dataConfigSource;
    }
    /**
     * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
     */
    PanelQueryRunner.prototype.getData = function (options) {
        var _this = this;
        var withFieldConfig = options.withFieldConfig, withTransforms = options.withTransforms;
        var structureRev = 1;
        var lastData = [];
        var processedCount = 0;
        var lastConfigRev = -1;
        var fastCompare = function (a, b) {
            return compareDataFrameStructures(a, b, true);
        };
        return this.subject.pipe(this.getTransformationsStream(withTransforms), map(function (data) {
            var _a, _b, _c;
            var processedData = data;
            var sameStructure = false;
            if (withFieldConfig && ((_a = data.series) === null || _a === void 0 ? void 0 : _a.length)) {
                // Apply field defaults and overrides
                var fieldConfig = _this.dataConfigSource.getFieldOverrideOptions();
                var processFields = fieldConfig != null;
                // If the shape is the same, we can skip field overrides
                if (data.state === LoadingState.Streaming &&
                    processFields &&
                    processedCount > 0 &&
                    lastData.length &&
                    lastConfigRev === _this.dataConfigSource.configRev) {
                    var sameTypes = compareArrayValues(lastData, processedData.series, fastCompare);
                    if (sameTypes) {
                        // Keep the previous field config settings
                        processedData = __assign(__assign({}, processedData), { series: lastData.map(function (frame, frameIndex) { return (__assign(__assign({}, frame), { length: data.series[frameIndex].length, fields: frame.fields.map(function (field, fieldIndex) { return (__assign(__assign({}, field), { values: data.series[frameIndex].fields[fieldIndex].values, state: __assign(__assign({}, field.state), { calcs: undefined, 
                                        // add global range calculation here? (not optimal for streaming)
                                        range: undefined }) })); }) })); }) });
                        processFields = false;
                        sameStructure = true;
                    }
                }
                if (processFields) {
                    lastConfigRev = _this.dataConfigSource.configRev;
                    processedCount++; // results with data
                    processedData = __assign(__assign({}, processedData), { series: applyFieldOverrides(__assign({ timeZone: (_c = (_b = data.request) === null || _b === void 0 ? void 0 : _b.timezone) !== null && _c !== void 0 ? _c : 'browser', data: processedData.series }, fieldConfig)) });
                }
            }
            if (!sameStructure) {
                sameStructure = compareArrayValues(lastData, processedData.series, compareDataFrameStructures);
            }
            if (!sameStructure) {
                structureRev++;
            }
            lastData = processedData.series;
            return __assign(__assign({}, processedData), { structureRev: structureRev });
        }));
    };
    PanelQueryRunner.prototype.run = function (options) {
        return __awaiter(this, void 0, void 0, function () {
            var queries, timezone, datasource, panelId, dashboardId, timeRange, timeInfo, cacheTimeout, maxDataPoints, scopedVars, minInterval, request, ds_1, lowerIntervalLimit, norm, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        queries = options.queries, timezone = options.timezone, datasource = options.datasource, panelId = options.panelId, dashboardId = options.dashboardId, timeRange = options.timeRange, timeInfo = options.timeInfo, cacheTimeout = options.cacheTimeout, maxDataPoints = options.maxDataPoints, scopedVars = options.scopedVars, minInterval = options.minInterval;
                        if (isSharedDashboardQuery(datasource)) {
                            this.pipeToSubject(runSharedRequest(options), panelId);
                            return [2 /*return*/];
                        }
                        request = {
                            app: CoreApp.Dashboard,
                            requestId: getNextRequestId(),
                            timezone: timezone,
                            panelId: panelId,
                            dashboardId: dashboardId,
                            range: timeRange,
                            timeInfo: timeInfo,
                            interval: '',
                            intervalMs: 0,
                            targets: cloneDeep(queries),
                            maxDataPoints: maxDataPoints,
                            scopedVars: scopedVars || {},
                            cacheTimeout: cacheTimeout,
                            startTime: Date.now(),
                        };
                        // Add deprecated property
                        request.rangeRaw = timeRange.raw;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, getDataSource(datasource, request.scopedVars)];
                    case 2:
                        ds_1 = _a.sent();
                        // Attach the data source name to each query
                        request.targets = request.targets.map(function (query) {
                            if (!query.datasource) {
                                query.datasource = { uid: ds_1.uid };
                            }
                            return query;
                        });
                        lowerIntervalLimit = minInterval ? getTemplateSrv().replace(minInterval, request.scopedVars) : ds_1.interval;
                        norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);
                        // make shallow copy of scoped vars,
                        // and add built in variables interval and interval_ms
                        request.scopedVars = Object.assign({}, request.scopedVars, {
                            __interval: { text: norm.interval, value: norm.interval },
                            __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
                        });
                        request.interval = norm.interval;
                        request.intervalMs = norm.intervalMs;
                        this.pipeToSubject(runRequest(ds_1, request), panelId);
                        return [3 /*break*/, 4];
                    case 3:
                        err_1 = _a.sent();
                        console.error('PanelQueryRunner Error', err_1);
                        return [3 /*break*/, 4];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PanelQueryRunner.prototype.pipeToSubject = function (observable, panelId) {
        var _this = this;
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        var panelData = observable;
        var dataSupport = this.dataConfigSource.getDataSupport();
        if (dataSupport.alertStates || dataSupport.annotations) {
            var panel = this.dataConfigSource;
            panelData = mergePanelAndDashData(observable, getDashboardQueryRunner().getResult(panel.id));
        }
        this.subscription = panelData.subscribe({
            next: function (data) {
                _this.lastResult = preProcessPanelData(data, _this.lastResult);
                // Store preprocessed query results for applying overrides later on in the pipeline
                _this.subject.next(_this.lastResult);
            },
        });
    };
    PanelQueryRunner.prototype.cancelQuery = function () {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        // If we have an old result with loading state, send it with done state
        if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
            this.subject.next(__assign(__assign({}, this.lastResult), { state: LoadingState.Done }));
        }
    };
    PanelQueryRunner.prototype.clearLastResult = function () {
        this.lastResult = undefined;
        // A new subject is also needed since it's a replay subject that remembers/sends last value
        this.subject = new ReplaySubject(1);
    };
    /**
     * Called when the panel is closed
     */
    PanelQueryRunner.prototype.destroy = function () {
        // Tell anyone listening that we are done
        if (this.subject) {
            this.subject.complete();
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    };
    PanelQueryRunner.prototype.useLastResultFrom = function (runner) {
        this.lastResult = runner.getLastResult();
        if (this.lastResult) {
            // The subject is a replay subject so anyone subscribing will get this last result
            this.subject.next(this.lastResult);
        }
    };
    PanelQueryRunner.prototype.getLastResult = function () {
        return this.lastResult;
    };
    return PanelQueryRunner;
}());
export { PanelQueryRunner };
function getDataSource(datasource, scopedVars) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (datasource && datasource.query) {
                        return [2 /*return*/, datasource];
                    }
                    return [4 /*yield*/, getDatasourceSrv().get(datasource, scopedVars)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
}
//# sourceMappingURL=PanelQueryRunner.js.map