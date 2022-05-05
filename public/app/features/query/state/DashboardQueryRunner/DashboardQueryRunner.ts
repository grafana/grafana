import { merge, Observable, ReplaySubject, Subject, Subscription, timer, Unsubscribable } from 'rxjs';
import { finalize, map, mapTo, mergeAll, reduce, share, takeUntil } from 'rxjs/operators';

import { AnnotationQuery } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { config } from 'app/core/config';
import { dedupAnnotations } from 'app/features/annotations/events_processing';

import { getTimeSrv, TimeSrv } from '../../../dashboard/services/TimeSrv';
import { DashboardModel } from '../../../dashboard/state';

import { AlertStatesWorker } from './AlertStatesWorker';
import { AnnotationsWorker } from './AnnotationsWorker';
import { SnapshotWorker } from './SnapshotWorker';
import { UnifiedAlertStatesWorker } from './UnifiedAlertStatesWorker';
import {
  DashboardQueryRunner,
  DashboardQueryRunnerOptions,
  DashboardQueryRunnerResult,
  DashboardQueryRunnerWorker,
  DashboardQueryRunnerWorkerResult,
} from './types';
import { getAnnotationsByPanelId } from './utils';

class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: ReplaySubject<DashboardQueryRunnerWorkerResult>;
  private readonly runs: Subject<DashboardQueryRunnerOptions>;
  private readonly cancellationStream: Subject<AnnotationQuery>;
  private readonly runsSubscription: Unsubscribable;
  private readonly eventsSubscription: Unsubscribable;

  constructor(
    private readonly dashboard: DashboardModel,
    private readonly timeSrv: TimeSrv = getTimeSrv(),
    private readonly workers: DashboardQueryRunnerWorker[] = [
      config.unifiedAlertingEnabled ? new UnifiedAlertStatesWorker() : new AlertStatesWorker(),
      new SnapshotWorker(),
      new AnnotationsWorker(),
    ]
  ) {
    this.run = this.run.bind(this);
    this.getResult = this.getResult.bind(this);
    this.cancel = this.cancel.bind(this);
    this.destroy = this.destroy.bind(this);
    this.executeRun = this.executeRun.bind(this);
    this.results = new ReplaySubject<DashboardQueryRunnerWorkerResult>(1);
    this.runs = new Subject<DashboardQueryRunnerOptions>();
    this.cancellationStream = new Subject<any>();
    this.runsSubscription = this.runs.subscribe((options) => this.executeRun(options));
    this.eventsSubscription = dashboard.events.subscribe(RefreshEvent, (event) => {
      this.run({ dashboard: this.dashboard, range: this.timeSrv.timeRange() });
    });
  }

  run(options: DashboardQueryRunnerOptions): void {
    this.runs.next(options);
  }

  getResult(panelId?: number): Observable<DashboardQueryRunnerResult> {
    return this.results.asObservable().pipe(
      map((result) => {
        const annotations = getAnnotationsByPanelId(result.annotations, panelId);
        const alertState = result.alertStates.find((res) => Boolean(panelId) && res.panelId === panelId);
        return { annotations: dedupAnnotations(annotations), alertState };
      })
    );
  }

  private executeRun(options: DashboardQueryRunnerOptions) {
    const workers = this.workers.filter((w) => w.canWork(options));
    const workerObservables = workers.map((w) => w.work(options));

    const resultSubscription = new Subscription();
    const resultObservable = merge(workerObservables).pipe(
      takeUntil(this.runs.asObservable()),
      mergeAll(),
      reduce((acc: DashboardQueryRunnerWorkerResult, value: DashboardQueryRunnerWorkerResult) => {
        // console.log({ acc: acc.annotations.length, value: value.annotations.length });
        // should we use scan or reduce here
        // reduce will only emit when all observables are completed
        // scan will emit when any observable is completed
        // choosing reduce to minimize re-renders
        acc.annotations = acc.annotations.concat(value.annotations);
        acc.alertStates = acc.alertStates.concat(value.alertStates);
        return acc;
      }),
      finalize(() => {
        resultSubscription.unsubscribe(); // important to avoid memory leaks
      }),
      share() // shared because we're using it in takeUntil below
    );

    const timerSubscription = new Subscription();
    const timerObservable = timer(200).pipe(
      mapTo({ annotations: [], alertStates: [] }),
      takeUntil(resultObservable),
      finalize(() => {
        timerSubscription.unsubscribe(); // important to avoid memory leaks
      })
    );

    // if the result takes longer than 200ms we just publish an empty result
    timerSubscription.add(
      timerObservable.subscribe((result) => {
        this.results.next(result);
      })
    );

    resultSubscription.add(
      resultObservable.subscribe((result: DashboardQueryRunnerWorkerResult) => {
        this.results.next(result);
      })
    );
  }

  cancel(annotation: AnnotationQuery): void {
    this.cancellationStream.next(annotation);
  }

  cancellations(): Observable<AnnotationQuery> {
    return this.cancellationStream.asObservable().pipe(share());
  }

  destroy(): void {
    this.results.complete();
    this.runs.complete();
    this.cancellationStream.complete();
    this.runsSubscription.unsubscribe();
    this.eventsSubscription.unsubscribe();
  }
}

let dashboardQueryRunner: DashboardQueryRunner | undefined;

function setDashboardQueryRunner(runner: DashboardQueryRunner): void {
  if (dashboardQueryRunner) {
    dashboardQueryRunner.destroy();
  }
  dashboardQueryRunner = runner;
}

export function getDashboardQueryRunner(): DashboardQueryRunner {
  if (!dashboardQueryRunner) {
    throw new Error('getDashboardQueryRunner can only be used after Grafana instance has started.');
  }
  return dashboardQueryRunner;
}

export interface DashboardQueryRunnerFactoryArgs {
  dashboard: DashboardModel;
  timeSrv?: TimeSrv;
  workers?: DashboardQueryRunnerWorker[];
}

export type DashboardQueryRunnerFactory = (args: DashboardQueryRunnerFactoryArgs) => DashboardQueryRunner;

let factory: DashboardQueryRunnerFactory | undefined;

export function setDashboardQueryRunnerFactory(instance: DashboardQueryRunnerFactory) {
  factory = instance;
}

export function createDashboardQueryRunner(args: DashboardQueryRunnerFactoryArgs): DashboardQueryRunner {
  if (!factory) {
    factory = ({ dashboard, timeSrv, workers }: DashboardQueryRunnerFactoryArgs) =>
      new DashboardQueryRunnerImpl(dashboard, timeSrv, workers);
  }

  const runner = factory(args);
  setDashboardQueryRunner(runner);
  return runner;
}
