import { __awaiter } from "tslib";
import { cloneDeep } from 'lodash';
import { of, ReplaySubject } from 'rxjs';
import { map, mergeMap, catchError } from 'rxjs/operators';
import { applyFieldOverrides, compareArrayValues, compareDataFrameStructures, CoreApp, getDefaultTimeRange, LoadingState, rangeUtil, toDataFrame, transformDataFrame, preProcessPanelData, } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { isStreamingDataFrame } from 'app/features/live/data/utils';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import { isSharedDashboardQuery, runSharedRequest } from '../../../plugins/datasource/dashboard';
import { getDashboardQueryRunner } from './DashboardQueryRunner/DashboardQueryRunner';
import { mergePanelAndDashData } from './mergePanelAndDashData';
import { runRequest } from './runRequest';
let counter = 100;
export function getNextRequestId() {
    return 'Q' + counter++;
}
export class PanelQueryRunner {
    constructor(dataConfigSource) {
        this.templateSrv = getTemplateSrv();
        this.resendLastResult = () => {
            if (this.lastResult) {
                this.subject.next(this.lastResult);
            }
        };
        this.subject = new ReplaySubject(1);
        this.dataConfigSource = dataConfigSource;
    }
    /**
     * Returns an observable that subscribes to the shared multi-cast subject (that reply last result).
     */
    getData(options) {
        const { withFieldConfig, withTransforms } = options;
        let structureRev = 1;
        let lastFieldConfig = undefined;
        let lastProcessedFrames = [];
        let lastRawFrames = [];
        let lastTransformations;
        let isFirstPacket = true;
        let lastConfigRev = -1;
        if (this.dataConfigSource.snapshotData) {
            const snapshotPanelData = {
                state: LoadingState.Done,
                series: this.dataConfigSource.snapshotData.map((v) => toDataFrame(v)),
                timeRange: getDefaultTimeRange(),
                structureRev,
            };
            return of(snapshotPanelData);
        }
        return this.subject.pipe(mergeMap((data) => {
            let fieldConfig = this.dataConfigSource.getFieldOverrideOptions();
            let transformations = this.dataConfigSource.getTransformations();
            if (data.series === lastRawFrames &&
                (lastFieldConfig === null || lastFieldConfig === void 0 ? void 0 : lastFieldConfig.fieldConfig) === (fieldConfig === null || fieldConfig === void 0 ? void 0 : fieldConfig.fieldConfig) &&
                lastTransformations === transformations) {
                return of(Object.assign(Object.assign({}, data), { structureRev, series: lastProcessedFrames }));
            }
            lastFieldConfig = fieldConfig;
            lastTransformations = transformations;
            lastRawFrames = data.series;
            let dataWithTransforms = of(data);
            if (withTransforms) {
                dataWithTransforms = this.applyTransformations(data);
            }
            return dataWithTransforms.pipe(map((data) => {
                var _a, _b, _c;
                let processedData = data;
                let streamingPacketWithSameSchema = false;
                if (withFieldConfig && ((_a = data.series) === null || _a === void 0 ? void 0 : _a.length)) {
                    if (lastConfigRev === this.dataConfigSource.configRev) {
                        const streamingDataFrame = data.series.find((data) => isStreamingDataFrame(data));
                        if (streamingDataFrame &&
                            !streamingDataFrame.packetInfo.schemaChanged &&
                            // TODO: remove the condition below after fixing
                            // https://github.com/grafana/grafana/pull/41492#issuecomment-970281430
                            lastProcessedFrames[0].fields.length === streamingDataFrame.fields.length) {
                            processedData = Object.assign(Object.assign({}, processedData), { series: lastProcessedFrames.map((frame, frameIndex) => (Object.assign(Object.assign({}, frame), { length: data.series[frameIndex].length, fields: frame.fields.map((field, fieldIndex) => (Object.assign(Object.assign({}, field), { values: data.series[frameIndex].fields[fieldIndex].values, state: Object.assign(Object.assign({}, field.state), { calcs: undefined, range: undefined }) }))) }))) });
                            streamingPacketWithSameSchema = true;
                        }
                    }
                    if (fieldConfig != null && (isFirstPacket || !streamingPacketWithSameSchema)) {
                        lastConfigRev = this.dataConfigSource.configRev;
                        processedData = Object.assign(Object.assign({}, processedData), { series: applyFieldOverrides(Object.assign({ timeZone: (_c = (_b = data.request) === null || _b === void 0 ? void 0 : _b.timezone) !== null && _c !== void 0 ? _c : 'browser', data: processedData.series }, fieldConfig)) });
                        if (processedData.annotations) {
                            processedData.annotations = applyFieldOverrides(Object.assign(Object.assign({ data: processedData.annotations }, fieldConfig), { fieldConfig: {
                                    defaults: {},
                                    overrides: [],
                                } }));
                        }
                        isFirstPacket = false;
                    }
                }
                if (!streamingPacketWithSameSchema &&
                    !compareArrayValues(lastProcessedFrames, processedData.series, compareDataFrameStructures)) {
                    structureRev++;
                }
                lastProcessedFrames = processedData.series;
                return Object.assign(Object.assign({}, processedData), { structureRev });
            }));
        }));
    }
    applyTransformations(data) {
        const transformations = this.dataConfigSource.getTransformations();
        if (!transformations || transformations.length === 0) {
            return of(data);
        }
        const ctx = {
            interpolate: (v) => { var _a; return this.templateSrv.replace(v, (_a = data === null || data === void 0 ? void 0 : data.request) === null || _a === void 0 ? void 0 : _a.scopedVars); },
        };
        return transformDataFrame(transformations, data.series, ctx).pipe(map((series) => (Object.assign(Object.assign({}, data), { series }))), catchError((err) => {
            console.warn('Error running transformation:', err);
            return of(Object.assign(Object.assign({}, data), { state: LoadingState.Error, errors: [toDataQueryError(err)] }));
        }));
    }
    run(options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { queries, timezone, datasource, panelId, dashboardUID, timeRange, timeInfo, cacheTimeout, queryCachingTTL, maxDataPoints, scopedVars, minInterval, app, } = options;
            if (isSharedDashboardQuery(datasource)) {
                this.pipeToSubject(runSharedRequest(options, queries[0]), panelId, true);
                return;
            }
            const request = {
                app: app !== null && app !== void 0 ? app : CoreApp.Dashboard,
                requestId: getNextRequestId(),
                timezone,
                panelId,
                dashboardUID,
                range: timeRange,
                timeInfo,
                interval: '',
                intervalMs: 0,
                targets: cloneDeep(queries),
                maxDataPoints: maxDataPoints,
                scopedVars: scopedVars || {},
                cacheTimeout,
                queryCachingTTL,
                startTime: Date.now(),
                rangeRaw: timeRange.raw,
            };
            try {
                const ds = yield getDataSource(datasource, request.scopedVars);
                const isMixedDS = (_a = ds.meta) === null || _a === void 0 ? void 0 : _a.mixed;
                // Attach the data source to each query
                request.targets = request.targets.map((query) => {
                    var _a;
                    const isExpressionQuery = ((_a = query.datasource) === null || _a === void 0 ? void 0 : _a.type) === ExpressionDatasourceRef.type;
                    // When using a data source variable, the panel might have the incorrect datasource
                    // stored, so when running the query make sure it is done with the correct one
                    if (!query.datasource || (query.datasource.uid !== ds.uid && !isMixedDS && !isExpressionQuery)) {
                        query.datasource = ds.getRef();
                    }
                    return query;
                });
                const lowerIntervalLimit = minInterval ? this.templateSrv.replace(minInterval, request.scopedVars) : ds.interval;
                const norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);
                // make shallow copy of scoped vars,
                // and add built in variables interval and interval_ms
                request.scopedVars = Object.assign({}, request.scopedVars, {
                    __interval: { text: norm.interval, value: norm.interval },
                    __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
                });
                request.interval = norm.interval;
                request.intervalMs = norm.intervalMs;
                request.filters = this.templateSrv.getAdhocFilters(ds.name);
                this.lastRequest = request;
                this.pipeToSubject(runRequest(ds, request), panelId);
            }
            catch (err) {
                this.pipeToSubject(of({
                    state: LoadingState.Error,
                    error: toDataQueryError(err),
                    series: [],
                    timeRange: request.range,
                }), panelId);
            }
        });
    }
    pipeToSubject(observable, panelId, skipPreProcess = false) {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        let panelData = observable;
        const dataSupport = this.dataConfigSource.getDataSupport();
        if (dataSupport.alertStates || dataSupport.annotations) {
            const panel = this.dataConfigSource;
            panelData = mergePanelAndDashData(observable, getDashboardQueryRunner().getResult(panel.id));
        }
        this.subscription = panelData.subscribe({
            next: (data) => {
                this.lastResult = skipPreProcess ? data : preProcessPanelData(data, this.lastResult);
                // Store preprocessed query results for applying overrides later on in the pipeline
                this.subject.next(this.lastResult);
            },
        });
    }
    cancelQuery() {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        // If we have an old result with loading or streaming state, send it with done state
        if (this.lastResult &&
            (this.lastResult.state === LoadingState.Loading || this.lastResult.state === LoadingState.Streaming)) {
            this.subject.next(Object.assign(Object.assign({}, this.lastResult), { state: LoadingState.Done }));
        }
    }
    clearLastResult() {
        this.lastResult = undefined;
        // A new subject is also needed since it's a replay subject that remembers/sends last value
        this.subject = new ReplaySubject(1);
    }
    /**
     * Called when the panel is closed
     */
    destroy() {
        // Tell anyone listening that we are done
        if (this.subject) {
            this.subject.complete();
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
    useLastResultFrom(runner) {
        this.lastResult = runner.getLastResult();
        if (this.lastResult) {
            // The subject is a replay subject so anyone subscribing will get this last result
            this.subject.next(this.lastResult);
        }
    }
    /** Useful from tests */
    setLastResult(data) {
        this.lastResult = data;
    }
    getLastResult() {
        return this.lastResult;
    }
    getLastRequest() {
        return this.lastRequest;
    }
}
function getDataSource(datasource, scopedVars) {
    return __awaiter(this, void 0, void 0, function* () {
        if (datasource && typeof datasource === 'object' && 'query' in datasource) {
            return datasource;
        }
        return yield getDatasourceSrv().get(datasource, scopedVars);
    });
}
//# sourceMappingURL=PanelQueryRunner.js.map