import { __assign, __values } from "tslib";
import { FieldType, getDisplayProcessor, sortLogsResult, standardTransformers, } from '@grafana/data';
import { config } from '@grafana/runtime';
import { groupBy } from 'lodash';
import { of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import { dataFrameToLogsModel } from '../../../core/logs_model';
import { refreshIntervalToSortOrder } from '../../../core/utils/explore';
import { preProcessPanelData } from '../../query/state/runRequest';
/**
 * When processing response first we try to determine what kind of dataframes we got as one query can return multiple
 * dataFrames with different type of data. This is later used for type specific processing. As we use this in
 * Observable pipeline, it decorates the existing panelData to pass the results to later processing stages.
 */
export var decorateWithFrameTypeMetadata = function (data) {
    var e_1, _a;
    var _b;
    var graphFrames = [];
    var tableFrames = [];
    var logsFrames = [];
    var traceFrames = [];
    var nodeGraphFrames = [];
    try {
        for (var _c = __values(data.series), _d = _c.next(); !_d.done; _d = _c.next()) {
            var frame = _d.value;
            switch ((_b = frame.meta) === null || _b === void 0 ? void 0 : _b.preferredVisualisationType) {
                case 'logs':
                    logsFrames.push(frame);
                    break;
                case 'graph':
                    graphFrames.push(frame);
                    break;
                case 'trace':
                    traceFrames.push(frame);
                    break;
                case 'table':
                    tableFrames.push(frame);
                    break;
                case 'nodeGraph':
                    nodeGraphFrames.push(frame);
                    break;
                default:
                    if (isTimeSeries(frame)) {
                        graphFrames.push(frame);
                        tableFrames.push(frame);
                    }
                    else {
                        // We fallback to table if we do not have any better meta info about the dataframe.
                        tableFrames.push(frame);
                    }
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
    return __assign(__assign({}, data), { graphFrames: graphFrames, tableFrames: tableFrames, logsFrames: logsFrames, traceFrames: traceFrames, nodeGraphFrames: nodeGraphFrames, graphResult: null, tableResult: null, logsResult: null });
};
export var decorateWithGraphResult = function (data) {
    if (!data.graphFrames.length) {
        return __assign(__assign({}, data), { graphResult: null });
    }
    return __assign(__assign({}, data), { graphResult: data.graphFrames });
};
/**
 * This processing returns Observable because it uses Transformer internally which result type is also Observable.
 * In this case the transformer should return single result but it is possible that in the future it could return
 * multiple results and so this should be used with mergeMap or similar to unbox the internal observable.
 */
export var decorateWithTableResult = function (data) {
    if (data.tableFrames.length === 0) {
        return of(__assign(__assign({}, data), { tableResult: null }));
    }
    data.tableFrames.sort(function (frameA, frameB) {
        var frameARefId = frameA.refId;
        var frameBRefId = frameB.refId;
        if (frameARefId > frameBRefId) {
            return 1;
        }
        if (frameARefId < frameBRefId) {
            return -1;
        }
        return 0;
    });
    var hasOnlyTimeseries = data.tableFrames.every(function (df) { return isTimeSeries(df); });
    // If we have only timeseries we do join on default time column which makes more sense. If we are showing
    // non timeseries or some mix of data we are not trying to join on anything and just try to merge them in
    // single table, which may not make sense in most cases, but it's up to the user to query something sensible.
    var transformer = hasOnlyTimeseries
        ? of(data.tableFrames).pipe(standardTransformers.seriesToColumnsTransformer.operator({}))
        : of(data.tableFrames).pipe(standardTransformers.mergeTransformer.operator({}));
    return transformer.pipe(map(function (frames) {
        var e_2, _a;
        var _b, _c, _d;
        var frame = frames[0];
        try {
            // set display processor
            for (var _e = __values(frame.fields), _f = _e.next(); !_f.done; _f = _e.next()) {
                var field = _f.value;
                field.display =
                    (_b = field.display) !== null && _b !== void 0 ? _b : getDisplayProcessor({
                        field: field,
                        theme: config.theme2,
                        timeZone: (_d = (_c = data.request) === null || _c === void 0 ? void 0 : _c.timezone) !== null && _d !== void 0 ? _d : 'browser',
                    });
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_f && !_f.done && (_a = _e.return)) _a.call(_e);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return __assign(__assign({}, data), { tableResult: frame });
    }));
};
export var decorateWithLogsResult = function (options) {
    if (options === void 0) { options = {}; }
    return function (data) {
        var _a;
        if (data.logsFrames.length === 0) {
            return __assign(__assign({}, data), { logsResult: null });
        }
        var intervalMs = (_a = data.request) === null || _a === void 0 ? void 0 : _a.intervalMs;
        var newResults = dataFrameToLogsModel(data.logsFrames, intervalMs, options.absoluteRange, options.queries);
        var sortOrder = refreshIntervalToSortOrder(options.refreshInterval);
        var sortedNewResults = sortLogsResult(newResults, sortOrder);
        var rows = sortedNewResults.rows;
        var series = config.featureToggles.fullRangeLogsVolume && options.fullRangeLogsVolumeAvailable
            ? undefined
            : sortedNewResults.series;
        var logsResult = __assign(__assign({}, sortedNewResults), { rows: rows, series: series });
        return __assign(__assign({}, data), { logsResult: logsResult });
    };
};
// decorateData applies all decorators
export function decorateData(data, queryResponse, absoluteRange, refreshInterval, queries, fullRangeLogsVolumeAvailable) {
    return of(data).pipe(map(function (data) { return preProcessPanelData(data, queryResponse); }), map(decorateWithFrameTypeMetadata), map(decorateWithGraphResult), map(decorateWithLogsResult({ absoluteRange: absoluteRange, refreshInterval: refreshInterval, queries: queries, fullRangeLogsVolumeAvailable: fullRangeLogsVolumeAvailable })), mergeMap(decorateWithTableResult));
}
/**
 * Check if frame contains time series, which for our purpose means 1 time column and 1 or more numeric columns.
 */
function isTimeSeries(frame) {
    var _a;
    var grouped = groupBy(frame.fields, function (field) { return field.type; });
    return Boolean(Object.keys(grouped).length === 2 && ((_a = grouped[FieldType.time]) === null || _a === void 0 ? void 0 : _a.length) === 1 && grouped[FieldType.number]);
}
//# sourceMappingURL=decorators.js.map