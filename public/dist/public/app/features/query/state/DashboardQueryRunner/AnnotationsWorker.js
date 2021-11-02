import { cloneDeep } from 'lodash';
import { from, merge, of } from 'rxjs';
import { catchError, filter, finalize, map, mergeAll, mergeMap, reduce, takeUntil } from 'rxjs/operators';
import { getDataSourceSrv } from '@grafana/runtime';
import { emptyResult, handleDatasourceSrvError, translateQueryResult } from './utils';
import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { AnnotationsQueryRunner } from './AnnotationsQueryRunner';
import { AnnotationQueryFinished, AnnotationQueryStarted } from '../../../../types/events';
import { getDashboardQueryRunner } from './DashboardQueryRunner';
var AnnotationsWorker = /** @class */ (function () {
    function AnnotationsWorker(runners) {
        if (runners === void 0) { runners = [
            new LegacyAnnotationQueryRunner(),
            new AnnotationsQueryRunner(),
        ]; }
        this.runners = runners;
    }
    AnnotationsWorker.prototype.canWork = function (_a) {
        var dashboard = _a.dashboard;
        var annotations = dashboard.annotations.list.find(AnnotationsWorker.getAnnotationsToProcessFilter);
        return Boolean(annotations);
    };
    AnnotationsWorker.prototype.work = function (options) {
        var _this = this;
        if (!this.canWork(options)) {
            return emptyResult();
        }
        var dashboard = options.dashboard, range = options.range;
        var annotations = dashboard.annotations.list.filter(AnnotationsWorker.getAnnotationsToProcessFilter);
        var observables = annotations.map(function (annotation) {
            var datasourceObservable = from(getDataSourceSrv().get(annotation.datasource)).pipe(catchError(handleDatasourceSrvError) // because of the reduce all observables need to be completed, so an erroneous observable wont do
            );
            return datasourceObservable.pipe(mergeMap(function (datasource) {
                var runner = _this.runners.find(function (r) { return r.canRun(datasource); });
                if (!runner) {
                    return of([]);
                }
                dashboard.events.publish(new AnnotationQueryStarted(annotation));
                return runner.run({ annotation: annotation, datasource: datasource, dashboard: dashboard, range: range }).pipe(takeUntil(getDashboardQueryRunner()
                    .cancellations()
                    .pipe(filter(function (a) { return a === annotation; }))), map(function (results) {
                    // store response in annotation object if this is a snapshot call
                    if (dashboard.snapshot) {
                        annotation.snapshotData = cloneDeep(results);
                    }
                    // translate result
                    return translateQueryResult(annotation, results);
                }), finalize(function () {
                    dashboard.events.publish(new AnnotationQueryFinished(annotation));
                }));
            }));
        });
        return merge(observables).pipe(mergeAll(), reduce(function (acc, value) {
            // should we use scan or reduce here
            // reduce will only emit when all observables are completed
            // scan will emit when any observable is completed
            // choosing reduce to minimize re-renders
            return acc.concat(value);
        }), map(function (annotations) {
            return { annotations: annotations, alertStates: [] };
        }));
    };
    AnnotationsWorker.getAnnotationsToProcessFilter = function (annotation) {
        return annotation.enable && !Boolean(annotation.snapshotData);
    };
    return AnnotationsWorker;
}());
export { AnnotationsWorker };
//# sourceMappingURL=AnnotationsWorker.js.map