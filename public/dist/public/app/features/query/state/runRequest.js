// Libraries
import { isString, map as isArray } from 'lodash';
import { from, merge, of, timer } from 'rxjs';
import { catchError, map, mapTo, share, takeUntil, tap } from 'rxjs/operators';
// Utils & Services
// Types
import { CoreApp, DataTopic, dateMath, LoadingState, } from '@grafana/data';
import { config, toDataQueryError, logError } from '@grafana/runtime';
import { isExpressionReference } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { backendSrv } from 'app/core/services/backend_srv';
import { queryIsEmpty } from 'app/core/utils/query';
import { dataSource as expressionDatasource } from 'app/features/expressions/ExpressionDatasource';
import { cancelNetworkRequestsOnUnsubscribe } from './processing/canceler';
import { emitDataRequestEvent } from './queryAnalytics';
/*
 * This function should handle composing a PanelData from multiple responses
 */
export function processResponsePacket(packet, state) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const request = state.panelData.request;
    const packets = Object.assign({}, state.packets);
    // updates to the same key will replace previous values
    const key = (_d = (_a = packet.key) !== null && _a !== void 0 ? _a : (_c = (_b = packet.data) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.refId) !== null && _d !== void 0 ? _d : 'A';
    packets[key] = packet;
    let loadingState = packet.state || LoadingState.Done;
    let error = undefined;
    let errors = undefined;
    const series = [];
    const annotations = [];
    for (const key in packets) {
        const packet = packets[key];
        if (packet.error || ((_e = packet.errors) === null || _e === void 0 ? void 0 : _e.length)) {
            loadingState = LoadingState.Error;
            error = packet.error;
            errors = packet.errors;
        }
        if (packet.data && packet.data.length) {
            for (const dataItem of packet.data) {
                if (((_f = dataItem.meta) === null || _f === void 0 ? void 0 : _f.dataTopic) === DataTopic.Annotations) {
                    annotations.push(dataItem);
                    continue;
                }
                series.push(dataItem);
            }
        }
    }
    const timeRange = getRequestTimeRange(request, loadingState);
    const panelData = {
        state: loadingState,
        series,
        annotations,
        error,
        errors,
        request,
        timeRange,
    };
    // we use a Set to deduplicate the traceIds
    const traceIdSet = new Set([...((_g = state.panelData.traceIds) !== null && _g !== void 0 ? _g : []), ...((_h = packet.traceIds) !== null && _h !== void 0 ? _h : [])]);
    if (traceIdSet.size > 0) {
        panelData.traceIds = Array.from(traceIdSet);
    }
    return { packets, panelData };
}
function getRequestTimeRange(request, loadingState) {
    const range = request.range;
    if (!isString(range.raw.from) || loadingState !== LoadingState.Streaming) {
        return range;
    }
    return Object.assign(Object.assign({}, range), { from: dateMath.parse(range.raw.from, false), to: dateMath.parse(range.raw.to, true) });
}
/**
 * This function handles the execution of requests & and processes the single or multiple response packets into
 * a combined PanelData response. It will
 *  Merge multiple responses into a single DataFrame array based on the packet key
 *  Will emit a loading state if no response after 50ms
 *  Cancel any still running network requests on unsubscribe (using request.requestId)
 */
export function runRequest(datasource, request, queryFunction) {
    let state = {
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
    const dataObservable = callQueryMethod(datasource, request, queryFunction).pipe(
    // Transform response packets into PanelData with merged results
    map((packet) => {
        if (!isArray(packet.data)) {
            throw new Error(`Expected response data to be array, got ${typeof packet.data}.`);
        }
        request.endTime = Date.now();
        state = processResponsePacket(packet, state);
        return state.panelData;
    }), 
    // handle errors
    catchError((err) => {
        console.error('runRequest.catchError', err);
        logError(err);
        return of(Object.assign(Object.assign({}, state.panelData), { state: LoadingState.Error, error: toDataQueryError(err) }));
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
    // If the datasource has defined a default query, make sure it's applied
    request.targets = request.targets.map((t) => {
        var _a;
        return queryIsEmpty(t)
            ? Object.assign(Object.assign({}, (_a = datasource === null || datasource === void 0 ? void 0 : datasource.getDefaultQuery) === null || _a === void 0 ? void 0 : _a.call(datasource, CoreApp.PanelEditor)), t) : t;
    });
    // If its a public datasource, just return the result. Expressions will be handled on the backend.
    if (config.publicDashboardAccessToken) {
        return from(datasource.query(request));
    }
    for (const target of request.targets) {
        if (isExpressionReference(target.datasource)) {
            return expressionDatasource.query(request);
        }
    }
    // Otherwise it is a standard datasource request
    const returnVal = queryFunction ? queryFunction(request) : datasource.query(request);
    return from(returnVal);
}
//# sourceMappingURL=runRequest.js.map