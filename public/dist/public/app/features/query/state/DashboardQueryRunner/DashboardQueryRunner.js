import { merge, ReplaySubject, Subject, Subscription, timer } from 'rxjs';
import { finalize, map, mapTo, mergeAll, reduce, share, takeUntil } from 'rxjs/operators';
import { RefreshEvent } from '@grafana/runtime';
import { config } from 'app/core/config';
import { dedupAnnotations } from 'app/features/annotations/events_processing';
import { getTimeSrv } from '../../../dashboard/services/TimeSrv';
import { AlertStatesWorker } from './AlertStatesWorker';
import { AnnotationsWorker } from './AnnotationsWorker';
import { SnapshotWorker } from './SnapshotWorker';
import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
import { getAnnotationsByPanelId } from './utils';
class DashboardQueryRunnerImpl {
    constructor(dashboard, timeSrv = getTimeSrv(), workers = [
        config.unifiedAlertingEnabled ? new UnifiedAlertStatesWorker() : new AlertStatesWorker(),
        new SnapshotWorker(),
        new AnnotationsWorker(),
    ]) {
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
        this.runsSubscription = this.runs.subscribe((options) => this.executeRun(options));
        this.eventsSubscription = dashboard.events.subscribe(RefreshEvent, (event) => {
            this.run({ dashboard: this.dashboard, range: this.timeSrv.timeRange() });
        });
    }
    run(options) {
        this.runs.next(options);
    }
    getResult(panelId) {
        return this.results.asObservable().pipe(map((result) => {
            const annotations = getAnnotationsByPanelId(result.annotations, panelId);
            const alertState = result.alertStates.find((res) => Boolean(panelId) && res.panelId === panelId);
            return { annotations: dedupAnnotations(annotations), alertState };
        }));
    }
    executeRun(options) {
        const workers = this.workers.filter((w) => w.canWork(options));
        const workerObservables = workers.map((w) => w.work(options));
        const resultSubscription = new Subscription();
        const resultObservable = merge(workerObservables).pipe(takeUntil(this.runs.asObservable()), mergeAll(), reduce((acc, value) => {
            // console.log({ acc: acc.annotations.length, value: value.annotations.length });
            // should we use scan or reduce here
            // reduce will only emit when all observables are completed
            // scan will emit when any observable is completed
            // choosing reduce to minimize re-renders
            acc.annotations = acc.annotations.concat(value.annotations);
            acc.alertStates = acc.alertStates.concat(value.alertStates);
            return acc;
        }), finalize(() => {
            resultSubscription.unsubscribe(); // important to avoid memory leaks
        }), share() // shared because we're using it in takeUntil below
        );
        const timerSubscription = new Subscription();
        const timerObservable = timer(200).pipe(mapTo({ annotations: [], alertStates: [] }), takeUntil(resultObservable), finalize(() => {
            timerSubscription.unsubscribe(); // important to avoid memory leaks
        }));
        // if the result takes longer than 200ms we just publish an empty result
        timerSubscription.add(timerObservable.subscribe((result) => {
            this.results.next(result);
        }));
        resultSubscription.add(resultObservable.subscribe((result) => {
            this.results.next(result);
        }));
    }
    cancel(annotation) {
        this.cancellationStream.next(annotation);
    }
    cancellations() {
        return this.cancellationStream.asObservable().pipe(share());
    }
    destroy() {
        this.results.complete();
        this.runs.complete();
        this.cancellationStream.complete();
        this.runsSubscription.unsubscribe();
        this.eventsSubscription.unsubscribe();
    }
}
let dashboardQueryRunner;
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
let factory;
export function setDashboardQueryRunnerFactory(instance) {
    factory = instance;
}
export function createDashboardQueryRunner(args) {
    if (!factory) {
        factory = ({ dashboard, timeSrv, workers }) => new DashboardQueryRunnerImpl(dashboard, timeSrv, workers);
    }
    const runner = factory(args);
    setDashboardQueryRunner(runner);
    return runner;
}
//# sourceMappingURL=DashboardQueryRunner.js.map