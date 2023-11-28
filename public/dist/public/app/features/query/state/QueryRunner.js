import { __awaiter } from "tslib";
import { cloneDeep } from 'lodash';
import { from, ReplaySubject } from 'rxjs';
import { first } from 'rxjs/operators';
import { CoreApp, rangeUtil, LoadingState, preProcessPanelData, } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { getNextRequestId } from './PanelQueryRunner';
import { setStructureRevision } from './processing/revision';
import { runRequest } from './runRequest';
export class QueryRunner {
    constructor() {
        this.subject = new ReplaySubject(1);
    }
    get() {
        return this.subject.asObservable();
    }
    run(options) {
        const { queries, timezone, datasource, panelId, app, dashboardUID, timeRange, timeInfo, cacheTimeout, queryCachingTTL, maxDataPoints, scopedVars, minInterval, } = options;
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        const request = {
            app: app !== null && app !== void 0 ? app : CoreApp.Unknown,
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
        };
        // Add deprecated property
        request.rangeRaw = timeRange.raw;
        from(getDataSource(datasource, request.scopedVars))
            .pipe(first())
            .subscribe({
            next: (ds) => {
                // Attach the datasource name to each query
                request.targets = request.targets.map((query) => {
                    if (!query.datasource) {
                        query.datasource = ds.getRef();
                    }
                    return query;
                });
                const lowerIntervalLimit = minInterval
                    ? getTemplateSrv().replace(minInterval, request.scopedVars)
                    : ds.interval;
                const norm = rangeUtil.calculateInterval(timeRange, maxDataPoints, lowerIntervalLimit);
                // make shallow copy of scoped vars,
                // and add built in variables interval and interval_ms
                request.scopedVars = Object.assign({}, request.scopedVars, {
                    __interval: { text: norm.interval, value: norm.interval },
                    __interval_ms: { text: norm.intervalMs.toString(), value: norm.intervalMs },
                });
                request.interval = norm.interval;
                request.intervalMs = norm.intervalMs;
                this.subscription = runRequest(ds, request).subscribe({
                    next: (data) => {
                        const results = preProcessPanelData(data, this.lastResult);
                        this.lastResult = setStructureRevision(results, this.lastResult);
                        // Store preprocessed query results for applying overrides later on in the pipeline
                        this.subject.next(this.lastResult);
                    },
                });
            },
            error: (error) => console.error('PanelQueryRunner Error', error),
        });
    }
    cancel() {
        if (!this.subscription) {
            return;
        }
        this.subscription.unsubscribe();
        // If we have an old result with loading state, send it with done state
        if (this.lastResult && this.lastResult.state === LoadingState.Loading) {
            this.subject.next(Object.assign(Object.assign({}, this.lastResult), { state: LoadingState.Done }));
        }
    }
    destroy() {
        // Tell anyone listening that we are done
        if (this.subject) {
            this.subject.complete();
        }
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
function getDataSource(datasource, scopedVars) {
    return __awaiter(this, void 0, void 0, function* () {
        if (datasource && 'query' in datasource) {
            return datasource;
        }
        return getDatasourceSrv().get(datasource, scopedVars);
    });
}
//# sourceMappingURL=QueryRunner.js.map