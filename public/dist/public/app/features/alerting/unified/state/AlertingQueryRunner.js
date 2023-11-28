import { __awaiter } from "tslib";
import { reject } from 'lodash';
import { of, ReplaySubject } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { dataFrameFromJSON, getDefaultTimeRange, LoadingState, rangeUtil, withLoadingIndicator, preProcessPanelData, } from '@grafana/data';
import { getDataSourceSrv, toDataQueryError, DataSourceWithBackend } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { cancelNetworkRequestsOnUnsubscribe } from 'app/features/query/state/processing/canceler';
import { setStructureRevision } from 'app/features/query/state/processing/revision';
import { getTimeRangeForExpression } from '../utils/timeRange';
export class AlertingQueryRunner {
    constructor(backendSrv = getBackendSrv(), dataSourceSrv = getDataSourceSrv()) {
        this.backendSrv = backendSrv;
        this.dataSourceSrv = dataSourceSrv;
        this.subject = new ReplaySubject(1);
        this.lastResult = {};
    }
    get() {
        return this.subject.asObservable();
    }
    run(queries) {
        return __awaiter(this, void 0, void 0, function* () {
            const empty = initialState(queries, LoadingState.Done);
            const queriesToExclude = [];
            // do not execute if one more of the queries are not runnable,
            // for example not completely configured
            for (const query of queries) {
                const refId = query.model.refId;
                if (isExpressionQuery(query.model)) {
                    continue;
                }
                const dataSourceInstance = yield this.dataSourceSrv.get(query.datasourceUid);
                const skipRunningQuery = dataSourceInstance instanceof DataSourceWithBackend &&
                    dataSourceInstance.filterQuery &&
                    !dataSourceInstance.filterQuery(query.model);
                if (skipRunningQuery) {
                    queriesToExclude.push(refId);
                }
            }
            const queriesToRun = reject(queries, (q) => queriesToExclude.includes(q.model.refId));
            if (queriesToRun.length === 0) {
                return this.subject.next(empty);
            }
            this.subscription = runRequest(this.backendSrv, queriesToRun).subscribe({
                next: (dataPerQuery) => {
                    const nextResult = applyChange(dataPerQuery, (refId, data) => {
                        const previous = this.lastResult[refId];
                        const preProcessed = preProcessPanelData(data, previous);
                        return setStructureRevision(preProcessed, previous);
                    });
                    this.lastResult = nextResult;
                    this.subject.next(this.lastResult);
                },
                error: (error) => {
                    this.lastResult = mapErrorToPanelData(this.lastResult, error);
                    this.subject.next(this.lastResult);
                },
            });
        });
    }
    cancel() {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        let requestIsRunning = false;
        const nextResult = applyChange(this.lastResult, (refId, data) => {
            if (data.state === LoadingState.Loading) {
                requestIsRunning = true;
            }
            return Object.assign(Object.assign({}, data), { state: LoadingState.Done });
        });
        if (requestIsRunning) {
            this.subject.next(nextResult);
        }
    }
    destroy() {
        if (this.subject) {
            this.subject.complete();
        }
        this.cancel();
    }
}
const runRequest = (backendSrv, queries) => {
    const initial = initialState(queries, LoadingState.Loading);
    const request = {
        data: { data: queries },
        url: '/api/v1/eval',
        method: 'POST',
        requestId: uuidv4(),
    };
    return withLoadingIndicator({
        whileLoading: initial,
        source: backendSrv.fetch(request).pipe(mapToPanelData(initial), catchError((error) => of(mapErrorToPanelData(initial, error))), cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId), share()),
    });
};
const initialState = (queries, state) => {
    return queries.reduce((dataByQuery, query) => {
        dataByQuery[query.refId] = {
            state,
            series: [],
            timeRange: getTimeRange(query, queries),
        };
        return dataByQuery;
    }, {});
};
const getTimeRange = (query, queries) => {
    if (isExpressionQuery(query.model)) {
        const relative = getTimeRangeForExpression(query.model, queries);
        return rangeUtil.relativeToTimeRange(relative);
    }
    if (!query.relativeTimeRange) {
        console.warn(`Query with refId: ${query.refId} did not have any relative time range, using default.`);
        return getDefaultTimeRange();
    }
    return rangeUtil.relativeToTimeRange(query.relativeTimeRange);
};
const mapToPanelData = (dataByQuery) => {
    return map((response) => {
        const { data } = response;
        const results = {};
        for (const [refId, result] of Object.entries(data.results)) {
            const { error, status, frames = [] } = result;
            // extract errors from the /eval results
            const errors = error ? [{ message: error, refId, status }] : [];
            results[refId] = {
                errors,
                timeRange: dataByQuery[refId].timeRange,
                state: LoadingState.Done,
                series: frames.map(dataFrameFromJSON),
            };
        }
        return results;
    });
};
const mapErrorToPanelData = (lastResult, error) => {
    const queryError = toDataQueryError(error);
    return applyChange(lastResult, (refId, data) => {
        return Object.assign(Object.assign({}, data), { state: LoadingState.Error, error: queryError });
    });
};
const applyChange = (initial, change) => {
    const nextResult = {};
    for (const [refId, data] of Object.entries(initial)) {
        nextResult[refId] = change(refId, data);
    }
    return nextResult;
};
//# sourceMappingURL=AlertingQueryRunner.js.map