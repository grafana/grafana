import { merge, ReplaySubject, Subject, Subscription, timer } from 'rxjs';
import { finalize, map, mapTo, mergeAll, reduce, share, takeUntil } from 'rxjs/operators';
import { dedupAnnotations } from 'app/features/annotations/events_processing';
import { AlertStatesWorker } from './AlertStatesWorker';
import { SnapshotWorker } from './SnapshotWorker';
import { AnnotationsWorker } from './AnnotationsWorker';
import { getAnnotationsByPanelId } from './utils';
import { getTimeSrv } from '../../../dashboard/services/TimeSrv';
import { RefreshEvent } from '@grafana/runtime';
import { config } from 'app/core/config';
import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
var DashboardQueryRunnerImpl = /** @class */ (function () {
    function DashboardQueryRunnerImpl(dashboard, timeSrv, workers) {
        var _this = this;
        if (timeSrv === void 0) { timeSrv = getTimeSrv(); }
        if (workers === void 0) { workers = [
            config.unifiedAlertingEnabled ? new UnifiedAlertStatesWorker() : new AlertStatesWorker(),
            new SnapshotWorker(),
            new AnnotationsWorker(),
        ]; }
        this.dashboard = dashboard;
        this.timeSrv = timeSrv;
        this.workers = workers;
        this.run = this.run.bind(this);
        this.getResult = this.getResult.bind(this);
        this.cancel = this.cancel.bind(this);
        this.destroy = this.destroy.bind(this);
        this.executeRun = this.executeRun.bind(this);
        this.results = new ReplaySubject(1);
        this.runs = new Subject();
        this.cancellationStream = new Subject();
        this.runsSubscription = this.runs.subscribe(function (options) { return _this.executeRun(options); });
        this.eventsSubscription = dashboard.events.subscribe(RefreshEvent, function (event) {
            _this.run({ dashboard: _this.dashboard, range: _this.timeSrv.timeRange() });
        });
    }
    DashboardQueryRunnerImpl.prototype.run = function (options) {
        this.runs.next(options);
    };
    DashboardQueryRunnerImpl.prototype.getResult = function (panelId) {
        return this.results.asObservable().pipe(map(function (result) {
            var annotations = getAnnotationsByPanelId(result.annotations, panelId);
            var alertState = result.alertStates.find(function (res) { return Boolean(panelId) && res.panelId === panelId; });
            return { annotations: dedupAnnotations(annotations), alertState: alertState };
        }));
    };
    DashboardQueryRunnerImpl.prototype.executeRun = function (options) {
        var _this = this;
        var workers = this.workers.filter(function (w) { return w.canWork(options); });
        var workerObservables = workers.map(function (w) { return w.work(options); });
        var resultSubscription = new Subscription();
        var resultObservable = merge(workerObservables).pipe(takeUntil(this.runs.asObservable()), mergeAll(), reduce(function (acc, value) {
            // console.log({ acc: acc.annotations.length, value: value.annotations.length });
            // should we use scan or reduce here
            // reduce will only emit when all observables are completed
            // scan will emit when any observable is completed
            // choosing reduce to minimize re-renders
            acc.annotations = acc.annotations.concat(value.annotations);
            acc.alertStates = acc.alertStates.concat(value.alertStates);
            return acc;
        }), finalize(function () {
            resultSubscription.unsubscribe(); // important to avoid memory leaks
        }), share() // shared because we're using it in takeUntil below
        );
        var timerSubscription = new Subscription();
        var timerObservable = timer(200).pipe(mapTo({ annotations: [], alertStates: [] }), takeUntil(resultObservable), finalize(function () {
            timerSubscription.unsubscribe(); // important to avoid memory leaks
        }));
        // if the result takes longer than 200ms we just publish an empty result
        timerSubscription.add(timerObservable.subscribe(function (result) {
            _this.results.next(result);
        }));
        resultSubscription.add(resultObservable.subscribe(function (result) {
            _this.results.next(result);
        }));
    };
    DashboardQueryRunnerImpl.prototype.cancel = function (annotation) {
        this.cancellationStream.next(annotation);
    };
    DashboardQueryRunnerImpl.prototype.cancellations = function () {
        return this.cancellationStream.asObservable().pipe(share());
    };
    DashboardQueryRunnerImpl.prototype.destroy = function () {
        this.results.complete();
        this.runs.complete();
        this.cancellationStream.complete();
        this.runsSubscription.unsubscribe();
        this.eventsSubscription.unsubscribe();
    };
    return DashboardQueryRunnerImpl;
}());
var dashboardQueryRunner;
function setDashboardQueryRunner(runner) {
    if (dashboardQueryRunner) {
        dashboardQueryRunner.destroy();
    }
    dashboardQueryRunner = runner;
}
export function getDashboardQueryRunner() {
    if (!dashboardQueryRunner) {
        throw new Error('getDashboardQueryRunner can only be used after Grafana instance has started.');
    }
    return dashboardQueryRunner;
}
var factory;
export function setDashboardQueryRunnerFactory(instance) {
    factory = instance;
}
export function createDashboardQueryRunner(args) {
    if (!factory) {
        factory = function (_a) {
            var dashboard = _a.dashboard, timeSrv = _a.timeSrv, workers = _a.workers;
            return new DashboardQueryRunnerImpl(dashboard, timeSrv, workers);
        };
    }
    var runner = factory(args);
    setDashboardQueryRunner(runner);
    return runner;
}
//# sourceMappingURL=DashboardQueryRunner.js.map