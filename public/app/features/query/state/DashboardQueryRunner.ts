import { from, merge, Observable, of, Subject, Unsubscribable } from 'rxjs';
import { catchError, map, mergeAll, mergeMap, reduce } from 'rxjs/operators';
import cloneDeep from 'lodash/cloneDeep';
import { AnnotationEvent, AppEvents, DataQuery, DataSourceApi } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';

import { AnnotationQueryOptions, AnnotationResult, AnnotationResults } from '../../annotations/types';
import { executeAnnotationQuery } from '../../annotations/annotations_srv';
import { appEvents } from '../../../core/core';
import { dedupAnnotations } from 'app/features/annotations/events_processing';

export interface DashboardQueryRunner {
  run: (options: AnnotationQueryOptions) => void;
  getResult: (panelId?: number) => Observable<AnnotationResult>;
  cancel: () => void;
  destroy: () => void;
}

export const emptyResult: () => Observable<AnnotationResults> = () => of({ annotations: [], alertStates: [] });

export class DashboardQueryRunnerImpl implements DashboardQueryRunner {
  private readonly results: Subject<AnnotationResults>;
  private readonly cancellations: Subject<{}>;
  private readonly subscription: Unsubscribable;

  constructor() {
    this.results = new Subject<AnnotationResults>();
    this.cancellations = new Subject<{}>();
  }

  run(options: AnnotationQueryOptions): void {
    console.log('Calling getDashboardQueryRunner with', options);
    const workers = getDashboardQueryRunnerWorkers().filter((w) => w.canRun(options));
    const observables = workers.map((w) => w.run(options));
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

  getResult(panelId: number): Observable<AnnotationResult> {
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

export interface Worker {
  canRun: (options: AnnotationQueryOptions) => boolean;
  run: (options: AnnotationQueryOptions) => Observable<AnnotationResults>;
}

export function getDashboardQueryRunnerWorkers(): Worker[] {
  return [new AlertStatesWorker(), new SnapshotWorker(), new AnnotationsWorker()];
}

export class AlertStatesWorker implements Worker {
  canRun({ dashboard, panel, range }: AnnotationQueryOptions): boolean {
    if (!dashboard.id) {
      return false;
    }

    // ignore if no alerts
    if (!panel?.alert) {
      return false;
    }

    if (range.raw.to !== 'now') {
      return false;
    }

    return true;
  }

  run(options: AnnotationQueryOptions): Observable<AnnotationResults> {
    if (!this.canRun(options)) {
      return emptyResult();
    }

    console.log('Running AlertStatesWorker');
    const { dashboard } = options;
    return from(
      getBackendSrv().get(
        '/api/alerts/states-for-dashboard',
        {
          dashboardId: dashboard.id,
        },
        `get-alert-states-${dashboard.id}`
      )
    ).pipe(
      map((alertStates) => {
        return { alertStates, annotations: [] };
      })
    );
  }
}

export class SnapshotWorker implements Worker {
  canRun({ dashboard }: AnnotationQueryOptions): boolean {
    const snapshots = dashboard.annotations.list.find((a) => a.enable && Boolean(a.snapshotData));
    return Boolean(snapshots);
  }

  run(options: AnnotationQueryOptions): Observable<AnnotationResults> {
    if (!this.canRun(options)) {
      return emptyResult();
    }

    console.log('Running SnapshotWorker');
    const { dashboard } = options;
    const dashAnnotations = dashboard.annotations.list.filter((a) => a.enable);
    const snapshots = dashAnnotations.filter((a) => Boolean(a.snapshotData));
    const annotations = snapshots.reduce((acc, curr) => {
      return acc.concat(this.translateQueryResult(curr, curr.snapshotData));
    }, [] as AnnotationEvent[]);

    return of({ annotations, alertStates: [] });
  }

  translateQueryResult(annotation: any, results: AnnotationEvent[]): AnnotationEvent[] {
    annotation = cloneDeep(annotation);
    delete annotation.snapshotData;

    for (const item of results) {
      item.source = annotation;
      item.color = annotation.iconColor;
      item.type = annotation.name;
      item.isRegion = Boolean(item.timeEnd && item.time !== item.timeEnd);
    }

    return results;
  }
}

export class AnnotationsWorker implements Worker {
  canRun({ dashboard }: AnnotationQueryOptions): boolean {
    const annotations = dashboard.annotations.list.find((a) => a.enable && !Boolean(a.snapshotData));
    return Boolean(annotations);
  }

  run(options: AnnotationQueryOptions): Observable<AnnotationResults> {
    if (!this.canRun(options)) {
      return emptyResult();
    }

    console.log('Running AnnotationsWorker');
    const { dashboard, range, panel } = options;
    const annotations = dashboard.annotations.list.filter((a) => a.enable && !Boolean(a.snapshotData));
    const runners = getAnnotationQueryRunners();
    const observables = annotations.map((annotation) => {
      const datasourcePromise = getDataSourceSrv().get(annotation.datasource);
      return from(datasourcePromise).pipe(
        mergeMap((datasource: DataSourceApi) => {
          const runner = runners.find((r) => r.canRun(datasource));
          if (!runner) {
            return of([]);
          }

          return runner.run({ annotation, datasource, dashboard, panel, range });
        })
      );
    });

    return merge(observables).pipe(
      mergeAll(),
      reduce((acc, value) => {
        // should we use scan or reduce here
        // reduce will only emit when all observables are completed
        // scan will emit when any observable is completed
        // choosing reduce to minimize re-renders
        return acc.concat(value);
      }),
      map((annotations) => {
        return { annotations, alertStates: [] };
      })
    );
  }

  translateQueryResult(annotation: any, results: AnnotationEvent[]): AnnotationEvent[] {
    // if annotation has snapshotData
    // make clone and remove it
    if (annotation.snapshotData) {
      annotation = cloneDeep(annotation);
      delete annotation.snapshotData;
    }

    for (const item of results) {
      item.source = annotation;
      item.color = annotation.iconColor;
      item.type = annotation.name;
      item.isRegion = Boolean(item.timeEnd && item.time !== item.timeEnd);
    }

    return results;
  }
}

export interface AnnotationQueryRunnerOptions extends AnnotationQueryOptions {
  datasource: DataSourceApi;
  annotation: {
    datasource: string;
    enable: boolean;
    name: string;
  } & DataQuery;
}

export interface AnnotationQueryRunner {
  canRun: (datasource: DataSourceApi) => boolean;
  run: (options: AnnotationQueryRunnerOptions) => Observable<AnnotationEvent[]>;
}

export function getAnnotationQueryRunners() {
  return [new LegacyAnnotationQueryRunner(), new AnnotationsQueryRunner()];
}

export class LegacyAnnotationQueryRunner implements AnnotationQueryRunner {
  canRun(datasource: DataSourceApi): boolean {
    return Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    return from(datasource.annotationQuery!({ range, rangeRaw: range.raw, annotation, dashboard }));
  }
}

export class AnnotationsQueryRunner implements AnnotationQueryRunner {
  canRun(datasource: DataSourceApi): boolean {
    return !Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({
    annotation,
    datasource,
    dashboard,
    range,
    panel,
  }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    return executeAnnotationQuery({ panel, dashboard, range }, datasource, annotation).pipe(
      map((result) => {
        return result.events ?? [];
      })
    );
  }
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
