import { __awaiter } from "tslib";
import { set, uniq } from 'lodash';
import { catchError, concatMap, finalize, from, lastValueFrom, map, mergeMap, Observable, repeat, scan, share, takeWhile, tap, zip, } from 'rxjs';
import { DataQueryErrorType, LoadingState, LogRowContextQueryDirection, rangeUtil, } from '@grafana/data';
import { config, toDataQueryResponse } from '@grafana/runtime';
import { CloudWatchLogsQueryStatus, } from '../types';
import { addDataLinksToLogsResponse } from '../utils/datalinks';
import { runWithRetry } from '../utils/logsRetry';
import { increasingInterval } from '../utils/rxjs/increasingInterval';
import { interpolateStringArrayUsingSingleOrMultiValuedVariable } from '../utils/templateVariableUtils';
import { CloudWatchRequest } from './CloudWatchRequest';
export const LOG_IDENTIFIER_INTERNAL = '__log__grafana_internal__';
export const LOGSTREAM_IDENTIFIER_INTERNAL = '__logstream__grafana_internal__';
// This class handles execution of CloudWatch logs query data queries
export class CloudWatchLogsQueryRunner extends CloudWatchRequest {
    constructor(instanceSettings, templateSrv, timeSrv) {
        super(instanceSettings, templateSrv);
        this.timeSrv = timeSrv;
        this.logQueries = {};
        /**
         * Handle log query. The log query works by starting the query on the CloudWatch and then periodically polling for
         * results.
         * @param logQueries
         * @param options
         */
        this.handleLogQueries = (logQueries, options) => {
            const validLogQueries = logQueries.filter(this.filterQuery);
            const startQueryRequests = validLogQueries.map((target) => {
                const interpolatedLogGroupArns = interpolateStringArrayUsingSingleOrMultiValuedVariable(this.templateSrv, (target.logGroups || this.instanceSettings.jsonData.logGroups || []).map((lg) => lg.arn), options.scopedVars);
                // need to support legacy format variables too
                const interpolatedLogGroupNames = interpolateStringArrayUsingSingleOrMultiValuedVariable(this.templateSrv, target.logGroupNames || this.instanceSettings.jsonData.defaultLogGroups || [], options.scopedVars, 'text');
                // if a log group template variable expands to log group that has already been selected in the log group picker, we need to remove duplicates.
                // Otherwise the StartLogQuery API will return a permission error
                const logGroups = uniq(interpolatedLogGroupArns).map((arn) => ({ arn, name: arn }));
                const logGroupNames = uniq(interpolatedLogGroupNames);
                return {
                    refId: target.refId,
                    region: this.templateSrv.replace(this.getActualRegion(target.region)),
                    queryString: this.templateSrv.replace(target.expression || '', options.scopedVars),
                    logGroups,
                    logGroupNames,
                };
            });
            const startTime = new Date();
            const timeoutFunc = () => {
                return Date.now() >= startTime.valueOf() + rangeUtil.intervalToMs(this.logsTimeout);
            };
            return runWithRetry((targets) => {
                return this.makeLogActionRequest('StartQuery', targets, options);
            }, startQueryRequests, timeoutFunc).pipe(mergeMap(({ frames, error }) => 
            // This queries for the results
            this.logsQuery(frames.map((dataFrame) => {
                var _a, _b, _c, _d;
                return ({
                    queryId: dataFrame.fields[0].values[0],
                    region: (_c = (_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b['Region']) !== null && _c !== void 0 ? _c : 'default',
                    refId: dataFrame.refId,
                    statsGroups: (_d = logQueries.find((target) => target.refId === dataFrame.refId)) === null || _d === void 0 ? void 0 : _d.statsGroups,
                });
            }), timeoutFunc).pipe(map((response) => {
                if (!response.error && error) {
                    response.error = error;
                }
                return response;
            }))), mergeMap((dataQueryResponse) => {
                return from((() => __awaiter(this, void 0, void 0, function* () {
                    yield addDataLinksToLogsResponse(dataQueryResponse, options, this.timeSrv.timeRange(), this.replaceVariableAndDisplayWarningIfMulti.bind(this), this.expandVariableToArray.bind(this), this.getActualRegion.bind(this), this.tracingDataSourceUid);
                    return dataQueryResponse;
                }))());
            }));
        };
        this.getLogRowContext = (row, { limit = 10, direction = LogRowContextQueryDirection.Backward } = {}, query) => __awaiter(this, void 0, void 0, function* () {
            let logStreamField = null;
            let logField = null;
            for (const field of row.dataFrame.fields) {
                if (field.name === LOGSTREAM_IDENTIFIER_INTERNAL) {
                    logStreamField = field;
                    if (logField !== null) {
                        break;
                    }
                }
                else if (field.name === LOG_IDENTIFIER_INTERNAL) {
                    logField = field;
                    if (logStreamField !== null) {
                        break;
                    }
                }
            }
            const requestParams = {
                limit,
                startFromHead: direction !== LogRowContextQueryDirection.Backward,
                region: query === null || query === void 0 ? void 0 : query.region,
                logGroupName: parseLogGroupName(logField.values[row.rowIndex]),
                logStreamName: logStreamField.values[row.rowIndex],
            };
            if (direction === LogRowContextQueryDirection.Backward) {
                requestParams.endTime = row.timeEpochMs;
            }
            else {
                requestParams.startTime = row.timeEpochMs;
            }
            const dataFrames = yield lastValueFrom(this.makeLogActionRequest('GetLogEvents', [requestParams]));
            return {
                data: dataFrames,
            };
        });
        this.tracingDataSourceUid = instanceSettings.jsonData.tracingDatasourceUid;
        this.logsTimeout = instanceSettings.jsonData.logsTimeout || '30m';
    }
    /**
     * Checks progress and polls data of a started logs query with some retry logic.
     * @param queryParams
     */
    logsQuery(queryParams, timeoutFunc) {
        this.logQueries = {};
        queryParams.forEach((param) => {
            var _a, _b, _c;
            this.logQueries[param.refId] = {
                id: param.queryId,
                region: param.region,
                statsQuery: (_c = ((_b = (_a = param.statsGroups) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0) > 0) !== null && _c !== void 0 ? _c : false,
            };
        });
        const dataFrames = increasingInterval({ startPeriod: 100, endPeriod: 1000, step: 300 }).pipe(concatMap((_) => this.makeLogActionRequest('GetQueryResults', queryParams)), repeat(), share());
        const initialValue = {
            failures: 0,
            prevRecordsMatched: {},
        };
        const consecutiveFailedAttempts = dataFrames.pipe(scan(({ failures, prevRecordsMatched }, frames) => {
            var _a, _b, _c, _d;
            failures++;
            for (const frame of frames) {
                const recordsMatched = (_c = (_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.stats) === null || _b === void 0 ? void 0 : _b.find((stat) => stat.displayName === 'Records scanned')) === null || _c === void 0 ? void 0 : _c.value;
                if (recordsMatched > ((_d = prevRecordsMatched[frame.refId]) !== null && _d !== void 0 ? _d : 0)) {
                    failures = 0;
                }
                prevRecordsMatched[frame.refId] = recordsMatched;
            }
            return { failures, prevRecordsMatched };
        }, initialValue), map(({ failures }) => failures), share());
        const queryResponse = zip(dataFrames, consecutiveFailedAttempts).pipe(tap(([dataFrames]) => {
            var _a, _b;
            for (const frame of dataFrames) {
                if ([
                    CloudWatchLogsQueryStatus.Complete,
                    CloudWatchLogsQueryStatus.Cancelled,
                    CloudWatchLogsQueryStatus.Failed,
                ].includes((_b = (_a = frame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b['Status']) &&
                    this.logQueries.hasOwnProperty(frame.refId)) {
                    delete this.logQueries[frame.refId];
                }
            }
        }), map(([dataFrames, failedAttempts]) => {
            if (timeoutFunc()) {
                for (const frame of dataFrames) {
                    set(frame, 'meta.custom.Status', CloudWatchLogsQueryStatus.Cancelled);
                }
            }
            return {
                data: dataFrames,
                key: 'test-key',
                state: dataFrames.every((dataFrame) => {
                    var _a, _b;
                    return [
                        CloudWatchLogsQueryStatus.Complete,
                        CloudWatchLogsQueryStatus.Cancelled,
                        CloudWatchLogsQueryStatus.Failed,
                    ].includes((_b = (_a = dataFrame.meta) === null || _a === void 0 ? void 0 : _a.custom) === null || _b === void 0 ? void 0 : _b['Status']);
                })
                    ? LoadingState.Done
                    : LoadingState.Loading,
                error: timeoutFunc()
                    ? {
                        message: `error: query timed out after ${failedAttempts} attempts`,
                        type: DataQueryErrorType.Timeout,
                    }
                    : undefined,
            };
        }), takeWhile(({ state }) => state !== LoadingState.Error && state !== LoadingState.Done, true));
        return withTeardown(queryResponse, () => this.stopQueries());
    }
    stopQueries() {
        if (Object.keys(this.logQueries).length > 0) {
            this.makeLogActionRequest('StopQuery', Object.values(this.logQueries).map((logQuery) => ({
                queryId: logQuery.id,
                region: logQuery.region,
                queryString: '',
                refId: '',
            }))).pipe(finalize(() => {
                this.logQueries = {};
            }));
        }
    }
    makeLogActionRequest(subtype, queryParams, options) {
        const range = (options === null || options === void 0 ? void 0 : options.range) || this.timeSrv.timeRange();
        const requestParams = {
            from: range.from.valueOf().toString(),
            to: range.to.valueOf().toString(),
            queries: queryParams.map((param) => (Object.assign({ 
                // eslint-ignore-next-line
                refId: param.refId || 'A', intervalMs: 1, maxDataPoints: 1, datasource: this.ref, type: 'logAction', subtype: subtype }, param))),
        };
        const resultsToDataFrames = (val) => toDataQueryResponse(val).data || [];
        return this.awsRequest(this.dsQueryEndpoint, requestParams, {
            'X-Cache-Skip': 'true',
        }).pipe(map((response) => resultsToDataFrames(response)), catchError((err) => {
            var _a, _b;
            if (config.featureToggles.datasourceQueryMultiStatus && err.status === 207) {
                throw err;
            }
            if (err.status === 400) {
                throw err;
            }
            if ((_a = err.data) === null || _a === void 0 ? void 0 : _a.error) {
                throw err.data.error;
            }
            else if ((_b = err.data) === null || _b === void 0 ? void 0 : _b.message) {
                // In PROD we do not supply .error
                throw err.data.message;
            }
            throw err;
        }));
    }
    filterQuery(query) {
        var _a, _b, _c;
        const hasMissingLegacyLogGroupNames = !((_a = query.logGroupNames) === null || _a === void 0 ? void 0 : _a.length);
        const hasMissingLogGroups = !((_b = query.logGroups) === null || _b === void 0 ? void 0 : _b.length);
        const hasMissingQueryString = !((_c = query.expression) === null || _c === void 0 ? void 0 : _c.length);
        if ((hasMissingLogGroups && hasMissingLegacyLogGroupNames) || hasMissingQueryString) {
            return false;
        }
        return true;
    }
}
function withTeardown(observable, onUnsubscribe) {
    return new Observable((subscriber) => {
        const innerSub = observable.subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.next(err),
            complete: () => subscriber.complete(),
        });
        return () => {
            innerSub.unsubscribe();
            onUnsubscribe();
        };
    });
}
function parseLogGroupName(logIdentifier) {
    const colonIndex = logIdentifier.lastIndexOf(':');
    return logIdentifier.slice(colonIndex + 1);
}
//# sourceMappingURL=CloudWatchLogsQueryRunner.js.map