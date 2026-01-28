import { from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AnnotationEvent, DataSourceApi } from '@grafana/data';
import { shouldUseLegacyRunner } from 'app/features/annotations/standardAnnotationSupport';

import { AnnotationQueryRunner, AnnotationQueryRunnerOptions } from './types';
import { handleAnnotationQueryRunnerError } from './utils';
import { queryLogger } from '../../utils';

export class LegacyAnnotationQueryRunner implements AnnotationQueryRunner {
  canRun(datasource?: DataSourceApi): boolean {
    if (!datasource) {
      return false;
    }

    if (shouldUseLegacyRunner(datasource)) {
      return true;
    }

    return Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    if (datasource?.annotationQuery === undefined) {
      queryLogger.logWarning('Datasource does not have an annotation query', { where: 'LegacyAnnotationQueryRunner.run' });
      return of([]);
    }

    const annotationQuery = datasource.annotationQuery({ range, rangeRaw: range.raw, annotation, dashboard });
    if (annotationQuery === undefined) {
      queryLogger.logWarning('Datasource does not have an annotation query', { where: 'LegacyAnnotationQueryRunner.run' });
      return of([]);
    }

    return from(annotationQuery).pipe(catchError(handleAnnotationQueryRunnerError));
  }
}
