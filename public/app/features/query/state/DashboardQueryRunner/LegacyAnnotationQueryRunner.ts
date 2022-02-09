import { from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AnnotationEvent, DataSourceApi } from '@grafana/data';

import { AnnotationQueryRunner, AnnotationQueryRunnerOptions } from './types';
import { handleAnnotationQueryRunnerError } from './utils';

export class LegacyAnnotationQueryRunner implements AnnotationQueryRunner {
  canRun(datasource?: DataSourceApi): boolean {
    if (!datasource) {
      return false;
    }

    return Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    return from(datasource!.annotationQuery!({ range, rangeRaw: range.raw, annotation, dashboard })).pipe(
      catchError(handleAnnotationQueryRunnerError)
    );
  }
}
