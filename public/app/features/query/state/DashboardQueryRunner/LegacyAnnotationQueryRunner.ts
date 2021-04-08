import { AnnotationQueryRunner, AnnotationQueryRunnerOptions } from './types';
import { AnnotationEvent, DataSourceApi } from '@grafana/data';
import { from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { handleAnnotationQueryRunnerError } from './operators';

export class LegacyAnnotationQueryRunner implements AnnotationQueryRunner {
  canRun(datasource: DataSourceApi): boolean {
    return Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    return from(datasource.annotationQuery!({ range, rangeRaw: range.raw, annotation, dashboard })).pipe(
      catchError(handleAnnotationQueryRunnerError)
    );
  }
}
