import { __assign, __values } from "tslib";
// Libraries
import { from, merge, of, timer } from 'rxjs';
import { isString, map as isArray } from 'lodash';
import { catchError, map, mapTo, share, takeUntil, tap } from 'rxjs/operators';
// Utils & Services
import { backendSrv } from 'app/core/services/backend_srv';
// Types
import { DataTopic, dateMath, guessFieldTypes, LoadingState, toDataFrame, } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { emitDataRequestEvent } from './queryAnalytics';
import { dataSource as expressionDatasource, ExpressionDatasourceID, ExpressionDatasourceUID, } from 'app/features/expressions/ExpressionDatasource';
import { cancelNetworkRequestsOnUnsubscribe } from './processing/canceler';
/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(packet, state) {
    var e_1, _a;
    var _b;
    var request = state.panelData.request;
    var packets = __assign({}, state.packets);
    packets[packet.key || 'A'] = packet;
    var loadingState = packet.state || LoadingState.Done;
    var error = undefined;
    var series = [];
    var annotations = [];
    for (var key in packets) {
        var packet_1 = packets[key];
        if (packet_1.error) {
            loadingState = LoadingState.Error;
            error = packet_1.error;
        }
        if (packet_1.data && packet_1.data.length) {
            try {
                for (var _c = (e_1 = void 0, __values(packet_1.data)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var dataItem = _d.value;
                    if (((_b = dataItem.meta) === null || _b === void 0 ? void 0 : _b.dataTopic) === DataTopic.Annotations) {
                        annotations.push(dataItem);
                        continue;
                    }
                    series.push(dataItem);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    }
    var timeRange = getRequestTimeRange(request, loadingState);
    var panelData = {
        state: loadingState,
        series: series,
        annotations: annotations,
        error: error,
        request: request,
        timeRange: timeRange,
    };
    return { packets: packets, panelData: panelData };
}
function getRequestTimeRange(request, loadingState) {
    var range = request.range;
    if (!isString(range.raw.from) || loadingState !== LoadingState.Streaming) {
        return range;
    }
    return __assign(__assign({}, range), { from: dateMath.parse(range.raw.from, false), to: dateMath.parse(range.raw.to, true) });
}
/**
 * This function handles the execution of requests & and processes the single or multiple response packets into
 * a combined PanelData response. It will
 *  Merge multiple responses into a single DataFrame array based on the packet key
 *  Will emit a loading state if no response after 50ms
 *  Cancel any still running network requests on unsubscribe (using request.requestId)
 */
export function runRequest(datasource, request, queryFunction) {
    var state = {
        panelData: {
            state: LoadingState.Loading,
            series: [],
            request: request,
            timeRange: request.range,
        },
        packets: {},
    };
    // Return early if there are no queries to run
    if (!request.targets.length) {
        request.endTime = Date.now();
        state.panelData.state = LoadingState.Done;
        return of(state.panelData);
    }
    var dataObservable = callQueryMethod(datasource, request, queryFunction).pipe(
    // Transform response packets into PanelData with merged results
    map(function (packet) {
        if (!isArray(packet.data)) {
            throw new Error("Expected response data to be array, got " + typeof packet.data + ".");
        }
        request.endTime = Date.now();
        state = processResponsePacket(packet, state);
        return state.panelData;
    }), 
    // handle errors
    catchError(function (err) {
        console.error('runRequest.catchError', err);
        return of(__assign(__assign({}, state.panelData), { state: LoadingState.Error, error: toDataQueryError(err) }));
    }), tap(emitDataRequestEvent(datasource)), 
    // finalize is triggered when subscriber unsubscribes
    // This makes sure any still running network requests are cancelled
    cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId), 
    // this makes it possible to share this observable in takeUntil
    share());
    // If 50ms without a response emit a loading state
    // mapTo will translate the timer event into state.panelData (which has state set to loading)
    // takeUntil will cancel the timer emit when first response packet is received on the dataObservable
    return merge(timer(200).pipe(mapTo(state.panelData), takeUntil(dataObservable)), dataObservable);
}
export function callQueryMethod(datasource, request, queryFunction) {
    var e_2, _a;
    try {
        // If any query has an expression, use the expression endpoint
        for (var _b = __values(request.targets), _c = _b.next(); !_c.done; _c = _b.next()) {
            var target = _c.value;
            if (target.datasource === ExpressionDatasourceID || target.datasource === ExpressionDatasourceUID) {
                return expressionDatasource.query(request);
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    // Otherwise it is a standard datasource request
    var returnVal = queryFunction ? queryFunction(request) : datasource.query(request);
    return from(returnVal);
}
/**
 * All panels will be passed tables that have our best guess at column type set
 *
 * This is also used by PanelChrome for snapshot support
 */
export function getProcessedDataFrames(results) {
    var e_3, _a, e_4, _b;
    if (!results || !isArray(results)) {
        return [];
    }
    var dataFrames = [];
    try {
        for (var results_1 = __values(results), results_1_1 = results_1.next(); !results_1_1.done; results_1_1 = results_1.next()) {
            var result = results_1_1.value;
            var dataFrame = guessFieldTypes(toDataFrame(result));
            if (dataFrame.fields && dataFrame.fields.length) {
                try {
                    // clear out the cached info
                    for (var _c = (e_4 = void 0, __values(dataFrame.fields)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var field = _d.value;
                        field.state = null;
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
            dataFrames.push(dataFrame);
        }
    }
    catch (e_3_1) { e_3 = { error: e_3_1 }; }
    finally {
        try {
            if (results_1_1 && !results_1_1.done && (_a = results_1.return)) _a.call(results_1);
        }
        finally { if (e_3) throw e_3.error; }
    }
    return dataFrames;
}
export function preProcessPanelData(data, lastResult) {
    var series = data.series, annotations = data.annotations;
    //  for loading states with no data, use last result
    if (data.state === LoadingState.Loading && series.length === 0) {
        if (!lastResult) {
            lastResult = data;
        }
        return __assign(__assign({}, lastResult), { state: LoadingState.Loading, request: data.request });
    }
    // Make sure the data frames are properly formatted
    var STARTTIME = performance.now();
    var processedDataFrames = getProcessedDataFrames(series);
    var annotationsProcessed = getProcessedDataFrames(annotations);
    var STOPTIME = performance.now();
    return __assign(__assign({}, data), { series: processedDataFrames, annotations: annotationsProcessed, timings: { dataProcessingTime: STOPTIME - STARTTIME } });
}
//# sourceMappingURL=runRequest.js.map