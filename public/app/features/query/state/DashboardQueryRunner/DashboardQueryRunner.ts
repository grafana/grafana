import { merge, Observable, of, Subject, Unsubscribable } from 'rxjs';
import { catchError, map, mergeAll, reduce } from 'rxjs/operators';
import { AppEvents } from '@grafana/data';
import { appEvents } from '../../../../core/core';
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

export const emptyResult: () => Observable<DashboardQueryRunnerWorkerResult> = () =>
  of({ annotations: [], alertStates: [] });

export class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: Subject<DashboardQueryRunnerWorkerResult>;
  private readonly cancellations: Subject<{}>;
  private readonly subscription: Unsubscribable;

  constructor() {
    this.results = new Subject<DashboardQueryRunnerWorkerResult>();
    this.cancellations = new Subject<{}>();
  }

  run(options: DashboardQueryRunnerOptions): void {
    console.log('Calling getDashboardQueryRunner with', options);
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
        }),
        catchError((err) => {
          if (err.cancelled) {
            return emptyResult();
          }

          if (!err.message && err.data && err.data.message) {
            err.message = err.data.message;
          }

          console.error('DashboardQueryRunner run error', err);
          appEvents.emit(AppEvents.alertError, ['DashboardQueryRunner Failed', err.message || err]);
          return emptyResult();
        })
      )
      .subscribe((x) => {
        console.log('DashboardQueryRunnerImpl.subscribe', x);
        this.results.next(x);
      });
  }

  getResult(panelId: number): Observable<DashboardQueryRunnerResult> {
    return this.results.asObservable().pipe(
      map((result) => {
        const annotations = result.annotations.filter((item) => {
          if (item.panelId && item.source?.type === 'dashboard') {
            return item.panelId === panelId;
          }
          return true;
        });

        const alertState = result.alertStates.find((res) => res.panelId === panelId);

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
