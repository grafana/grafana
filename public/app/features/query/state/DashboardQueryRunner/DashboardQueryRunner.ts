import { merge, Observable, ReplaySubject, Subject, Unsubscribable } from 'rxjs';
import { map, mergeAll, reduce } from 'rxjs/operators';
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
import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { AnnotationsQueryRunner } from './AnnotationsQueryRunner';

export class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: ReplaySubject<DashboardQueryRunnerWorkerResult>;
  private readonly cancellations: Subject<{}>;
  private readonly subscription: Unsubscribable;

  constructor() {
    this.results = new ReplaySubject<DashboardQueryRunnerWorkerResult>(1);
    this.cancellations = new Subject<{}>();
  }

  run(options: DashboardQueryRunnerOptions): void {
    const workers = getDashboardQueryRunnerWorkers().filter((w) => w.canWork(options));
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
        const annotations = result.annotations.filter((item) => {
          if (Boolean(panelId) && item.panelId && item.source?.type === 'dashboard') {
            return item.panelId === panelId;
          }
          return true;
        });

        const alertState = result.alertStates.find((res) => Boolean(panelId) && res.panelId === panelId);

        return { annotations: dedupAnnotations(annotations), alertState };
      })
    );
  }

  cancel(): void {}

  destroy(): void {
    this.results.complete();
    this.cancellations.complete();
    this.subscription.unsubscribe();
  }
}

export function getDashboardQueryRunnerWorkers(): DashboardQueryRunnerWorker[] {
  return [new AlertStatesWorker(), new SnapshotWorker(), new AnnotationsWorker()];
}

export function getAnnotationQueryRunners() {
  return [new LegacyAnnotationQueryRunner(), new AnnotationsQueryRunner()];
}

let dashboardQueryRunner: DashboardQueryRunner | undefined;

export function setDashboardQueryRunner(runner: DashboardQueryRunner): void {
  dashboardQueryRunner = runner;
}

export function getDashboardQueryRunner(): DashboardQueryRunner {
  if (!dashboardQueryRunner) {
    throw new Error('getDashboardQueryRunner can only be used after Grafana instance has started.');
  }
  return dashboardQueryRunner;
}
