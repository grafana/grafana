import { merge, Observable, Subject, Unsubscribable } from 'rxjs';
import { map, mergeAll, reduce, share } from 'rxjs/operators';

import { dedupAnnotations } from 'app/features/annotations/events_processing';
import {
  DashboardQueryRunner,
  DashboardQueryRunnerOptions,
  DashboardQueryRunnerResult,
  DashboardQueryRunnerWorker,
  DashboardQueryRunnerWorkerResult,
} from './types';
import { AlertStatesWorker } from './AlertStatesWorker';
import { SnapshotWorker } from './SnapshotWorker';
import { AnnotationsWorker } from './AnnotationsWorker';
import { getAnnotationsByPanelId } from './utils';
import { DashboardModel } from '../../../dashboard/state';
import { getTimeSrv, TimeSrv } from '../../../dashboard/services/TimeSrv';
import { RefreshEvent } from '../../../../types/events';

export class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: Subject<DashboardQueryRunnerWorkerResult>;
  private readonly cancellations: Subject<{}>;
  private readonly subscription: Unsubscribable;
  private readonly eventsSubscription: Unsubscribable;

  constructor(
    private readonly dashboard: DashboardModel,
    private readonly timeSrv: TimeSrv = getTimeSrv(),
    private readonly workers: DashboardQueryRunnerWorker[] = [
      new AlertStatesWorker(),
      new SnapshotWorker(),
      new AnnotationsWorker(),
    ]
  ) {
    this.run = this.run.bind(this);
    this.getResult = this.getResult.bind(this);
    this.cancel = this.cancel.bind(this);
    this.destroy = this.destroy.bind(this);
    this.results = new Subject<DashboardQueryRunnerWorkerResult>();
    this.cancellations = new Subject<{}>();
    this.eventsSubscription = dashboard.events.subscribe(RefreshEvent, (event) => {
      this.run({ dashboard: this.dashboard, range: this.timeSrv.timeRange() });
    });
  }

  run(options: DashboardQueryRunnerOptions): void {
    const workers = this.workers.filter((w) => w.canWork(options));
    const observables = workers.map((w) => w.work(options));
    merge(observables)
      .pipe(
        mergeAll(),
        reduce((acc, value) => {
          // should we use scan or reduce here
          // reduce will only emit when all observables are completed
          // scan will emit when any observable is completed
          // choosing reduce to minimize re-renders
          acc.annotations = acc.annotations.concat(value.annotations);
          acc.alertStates = acc.alertStates.concat(value.alertStates);
          return acc;
        })
      )
      .subscribe((x) => {
        this.results.next(x);
      });
  }

  getResult(panelId?: number): Observable<DashboardQueryRunnerResult> {
    return this.results.asObservable().pipe(
      map((result) => {
        const annotations = getAnnotationsByPanelId(result.annotations, panelId);

        const alertState = result.alertStates.find((res) => Boolean(panelId) && res.panelId === panelId);

        return { annotations: dedupAnnotations(annotations), alertState };
      }),
      share() // sharing this so we can merge this with it self in mergePanelAndDashData
    );
  }

  cancel(): void {}

  destroy(): void {
    this.results.complete();
    this.cancellations.complete();
    this.subscription.unsubscribe();
    this.eventsSubscription.unsubscribe();
  }
}

let dashboardQueryRunner: DashboardQueryRunner | undefined;

export function setDashboardQueryRunner(runner: DashboardQueryRunner): void {
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
