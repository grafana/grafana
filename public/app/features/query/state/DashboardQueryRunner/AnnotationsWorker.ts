import { DashboardQueryRunnerOptions, DashboardQueryRunnerWorker, DashboardQueryRunnerWorkerResult } from './types';
import { from, merge, Observable, of } from 'rxjs';
import { getDataSourceSrv } from '@grafana/runtime';
import { map, mergeAll, mergeMap, reduce } from 'rxjs/operators';
import { AnnotationEvent, DataSourceApi } from '@grafana/data';
import cloneDeep from 'lodash/cloneDeep';
import { emptyResult, getAnnotationQueryRunners } from './DashboardQueryRunner';

export class AnnotationsWorker implements DashboardQueryRunnerWorker {
  canWork({ dashboard }: DashboardQueryRunnerOptions): boolean {
    const annotations = dashboard.annotations.list.find((a) => a.enable && !Boolean(a.snapshotData));
    return Boolean(annotations);
  }

  work(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canWork(options)) {
      return emptyResult();
    }

    console.log('Running AnnotationsWorker');
    const { dashboard, range } = options;
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

          return runner.run({ annotation, datasource, dashboard, range });
        }),
        map((results) => {
          // store response in annotation object if this is a snapshot call
          if (dashboard.snapshot) {
            annotation.snapshotData = cloneDeep(results);
          }
          // translate result
          return this.translateQueryResult(annotation, results);
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
