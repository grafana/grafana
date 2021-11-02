import { __assign, __read, __values } from "tslib";
import { of, ReplaySubject } from 'rxjs';
import { catchError, map, share } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { dataFrameFromJSON, getDefaultTimeRange, LoadingState, rangeUtil, withLoadingIndicator, } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { preProcessPanelData } from 'app/features/query/state/runRequest';
import { getTimeRangeForExpression } from '../utils/timeRange';
import { isExpressionQuery } from 'app/features/expressions/guards';
import { setStructureRevision } from 'app/features/query/state/processing/revision';
import { cancelNetworkRequestsOnUnsubscribe } from 'app/features/query/state/processing/canceler';
var AlertingQueryRunner = /** @class */ (function () {
    function AlertingQueryRunner(backendSrv) {
        if (backendSrv === void 0) { backendSrv = getBackendSrv(); }
        this.backendSrv = backendSrv;
        this.subject = new ReplaySubject(1);
        this.lastResult = {};
    }
    AlertingQueryRunner.prototype.get = function () {
        return this.subject.asObservable();
    };
    AlertingQueryRunner.prototype.run = function (queries) {
        var _this = this;
        if (queries.length === 0) {
            var empty = initialState(queries, LoadingState.Done);
            return this.subject.next(empty);
        }
        this.subscription = runRequest(this.backendSrv, queries).subscribe({
            next: function (dataPerQuery) {
                var nextResult = applyChange(dataPerQuery, function (refId, data) {
                    var previous = _this.lastResult[refId];
                    var preProcessed = preProcessPanelData(data, previous);
                    return setStructureRevision(preProcessed, previous);
                });
                _this.lastResult = nextResult;
                _this.subject.next(_this.lastResult);
            },
            error: function (error) {
                _this.lastResult = mapErrorToPanelData(_this.lastResult, error);
                _this.subject.next(_this.lastResult);
            },
        });
    };
    AlertingQueryRunner.prototype.cancel = function () {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        var requestIsRunning = false;
        var nextResult = applyChange(this.lastResult, function (refId, data) {
            if (data.state === LoadingState.Loading) {
                requestIsRunning = true;
            }
            return __assign(__assign({}, data), { state: LoadingState.Done });
        });
        if (requestIsRunning) {
            this.subject.next(nextResult);
        }
    };
    AlertingQueryRunner.prototype.destroy = function () {
        if (this.subject) {
            this.subject.complete();
        }
        this.cancel();
    };
    return AlertingQueryRunner;
}());
export { AlertingQueryRunner };
var runRequest = function (backendSrv, queries) {
    var initial = initialState(queries, LoadingState.Loading);
    var request = {
        data: { data: queries },
        url: '/api/v1/eval',
        method: 'POST',
        requestId: uuidv4(),
    };
    return withLoadingIndicator({
        whileLoading: initial,
        source: backendSrv.fetch(request).pipe(mapToPanelData(initial), catchError(function (error) { return of(mapErrorToPanelData(initial, error)); }), cancelNetworkRequestsOnUnsubscribe(backendSrv, request.requestId), share()),
    });
};
var initialState = function (queries, state) {
    return queries.reduce(function (dataByQuery, query) {
        dataByQuery[query.refId] = {
            state: state,
            series: [],
            timeRange: getTimeRange(query, queries),
        };
        return dataByQuery;
    }, {});
};
var getTimeRange = function (query, queries) {
    if (isExpressionQuery(query.model)) {
        var relative = getTimeRangeForExpression(query.model, queries);
        return rangeUtil.relativeToTimeRange(relative);
    }
    if (!query.relativeTimeRange) {
        console.warn("Query with refId: " + query.refId + " did not have any relative time range, using default.");
        return getDefaultTimeRange();
    }
    return rangeUtil.relativeToTimeRange(query.relativeTimeRange);
};
var mapToPanelData = function (dataByQuery) {
    return map(function (response) {
        var e_1, _a;
        var data = response.data;
        var results = {};
        try {
            for (var _b = __values(Object.entries(data.results)), _c = _b.next(); !_c.done; _c = _b.next()) {
                var _d = __read(_c.value, 2), refId = _d[0], result = _d[1];
                results[refId] = {
                    timeRange: dataByQuery[refId].timeRange,
                    state: LoadingState.Done,
                    series: result.frames.map(dataFrameFromJSON),
                };
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return results;
    });
};
var mapErrorToPanelData = function (lastResult, error) {
    var queryError = toDataQueryError(error);
    return applyChange(lastResult, function (refId, data) {
        return __assign(__assign({}, data), { state: LoadingState.Error, error: queryError });
    });
};
var applyChange = function (initial, change) {
    var e_2, _a;
    var nextResult = {};
    try {
        for (var _b = __values(Object.entries(initial)), _c = _b.next(); !_c.done; _c = _b.next()) {
            var _d = __read(_c.value, 2), refId = _d[0], data = _d[1];
            nextResult[refId] = change(refId, data);
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return nextResult;
};
//# sourceMappingURL=AlertingQueryRunner.js.map