import { __assign, __awaiter, __generator } from "tslib";
import { CoreApp, rangeUtil, LoadingState, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { cloneDeep } from 'lodash';
import { from, ReplaySubject } from 'rxjs';
import { first } from 'rxjs/operators';
import { getNextRequestId } from './PanelQueryRunner';
import { setStructureRevision } from './processing/revision';
import { preProcessPanelData, runRequest } from './runRequest';
var QueryRunner = /** @class */ (function () {
    function QueryRunner() {
        this.subject = new ReplaySubject(1);
    }
    QueryRunner.prototype.get = function () {
        return this.subject.asObservable();
    };
    QueryRunner.prototype.run = function (options) {
        var _this = this;
        var queries = options.queries, timezone = options.timezone, datasource = options.datasource, panelId = options.panelId, app = options.app, dashboardId = options.dashboardId, timeRange = options.timeRange, timeInfo = options.timeInfo, cacheTimeout = options.cacheTimeout, maxDataPoints = options.maxDataPoints, scopedVars = options.scopedVars, minInterval = options.minInterval;
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        var request = {
            app: app !== null && app !== void 0 ? app : CoreApp.Unknown,
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
        from(getDataSource(datasource, request.scopedVars))
            .pipe(first())
            .subscribe({
            next: function (ds) {
                // Attach the datasource name to each query
                request.targets = request.targets.map(function (query) {
                    if (!query.datasource) {
                        query.datasource = ds.getRef();
                    }
                    return query;
                });
                var lowerIntervalLimit = minInterval
                    ? getTemplateSrv().replace(minInterval, request.scopedVars)
                    : ds.interval;
                var norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);
                // make shallow copy of scoped vars,
                // and add built in variables interval and interval_ms
                request.scopedVars = Object.assign({}, request.scopedVars, {
                    __interval: { text: norm.interval, value: norm.interval },
                    __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
                });
                request.interval = norm.interval;
                request.intervalMs = norm.intervalMs;
                _this.subscription = runRequest(ds, request).subscribe({
                    next: function (data) {
                        var results = preProcessPanelData(data, _this.lastResult);
                        _this.lastResult = setStructureRevision(results, _this.lastResult);
                        // Store preprocessed query results for applying overrides later on in the pipeline
                        _this.subject.next(_this.lastResult);
                    },
                });
            },
            error: function (error) { return console.error('PanelQueryRunner Error', error); },
        });
    };
    QueryRunner.prototype.cancel = function () {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        // If we have an old result with loading state, send it with done state
        if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
            this.subject.next(__assign(__assign({}, this.lastResult), { state: LoadingState.Done }));
        }
    };
    QueryRunner.prototype.destroy = function () {
        // Tell anyone listening that we are done
        if (this.subject) {
            this.subject.complete();
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    };
    return QueryRunner;
}());
export { QueryRunner };
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
//# sourceMappingURL=QueryRunner.js.map