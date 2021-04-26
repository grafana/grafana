import { cloneDeep } from 'lodash';
import { from, merge, Observable, of } from 'rxjs';
import { map, mergeAll, mergeMap, reduce } from 'rxjs/operators';
import { getDataSourceSrv } from '@grafana/runtime';
import { AnnotationQuery, DataSourceApi } from '@grafana/data';

import {
  AnnotationQueryRunner,
  DashboardQueryRunnerOptions,
  DashboardQueryRunnerWorker,
  DashboardQueryRunnerWorkerResult,
} from './types';
import { emptyResult, translateQueryResult } from './utils';
import { LegacyAnnotationQueryRunner } from './LegacyAnnotationQueryRunner';
import { AnnotationsQueryRunner } from './AnnotationsQueryRunner';

export class AnnotationsWorker implements DashboardQueryRunnerWorker {
  constructor(
    private readonly runners: AnnotationQueryRunner[] = [
      new LegacyAnnotationQueryRunner(),
      new AnnotationsQueryRunner(),
    ]
  ) {}

  canWork({ dashboard }: DashboardQueryRunnerOptions): boolean {
    const annotations = dashboard.annotations.list.find(AnnotationsWorker.getAnnotationsToProcessFilter);
    return Boolean(annotations);
  }

  work(options: DashboardQueryRunnerOptions): Observable<DashboardQueryRunnerWorkerResult> {
    if (!this.canWork(options)) {
      return emptyResult();
    }

    const { dashboard, range } = options;
    const annotations = dashboard.annotations.list.filter(AnnotationsWorker.getAnnotationsToProcessFilter);
    const observables = annotations.map((annotation) => {
      const datasourcePromise = getDataSourceSrv().get(annotation.datasource);
      return from(datasourcePromise).pipe(
        mergeMap((datasource: DataSourceApi) => {
          const runner = this.runners.find((r) => r.canRun(datasource));
          if (!runner) {
            return of([]);
          }

          return runner.run({ annotation, datasource, dashboard, range }).pipe(
            map((results) => {
              // store response in annotation object if this is a snapshot call
              if (dashboard.snapshot) {
                annotation.snapshotData = cloneDeep(results);
              }
              // translate result
              return translateQueryResult(annotation, results);
            })
          );
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

  private static getAnnotationsToProcessFilter(annotation: AnnotationQuery): boolean {
    return annotation.enable && !Boolean(annotation.snapshotData);
  }
}
