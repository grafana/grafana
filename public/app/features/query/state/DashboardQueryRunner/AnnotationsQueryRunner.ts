import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AnnotationEvent, DataSourceApi } from '@grafana/data';

import { executeAnnotationQuery } from '../../../annotations/executeAnnotationQuery';
import { PanelModel } from '../../../dashboard/state';

import { AnnotationQueryRunner, AnnotationQueryRunnerOptions } from './types';
import { handleAnnotationQueryRunnerError } from './utils';

export class AnnotationsQueryRunner implements AnnotationQueryRunner {
  canRun(datasource?: DataSourceApi): boolean {
    if (!datasource) {
      return false;
    }

    return Boolean(!datasource.annotationQuery || datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    const panel: PanelModel = {} as unknown as PanelModel; // deliberate setting panel to empty object because executeAnnotationQuery shouldn't depend on panelModel

    return executeAnnotationQuery({ dashboard, range, panel }, datasource!, annotation).pipe(
      map((result) => {
        return result.events ?? [];
      }),
      catchError(handleAnnotationQueryRunnerError)
    );
  }
}
