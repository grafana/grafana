import { AnnotationQueryRunner, AnnotationQueryRunnerOptions } from './types';
import { AnnotationEvent, DataSourceApi } from '@grafana/data';
import { Observable, of } from 'rxjs';
import { PanelModel } from '../../../dashboard/state';
import { executeAnnotationQuery } from '../../../annotations/annotations_srv';
import { map } from 'rxjs/operators';

export class AnnotationsQueryRunner implements AnnotationQueryRunner {
  canRun(datasource: DataSourceApi): boolean {
    return !Boolean(datasource.annotationQuery && !datasource.annotations);
  }

  run({ annotation, datasource, dashboard, range }: AnnotationQueryRunnerOptions): Observable<AnnotationEvent[]> {
    if (!this.canRun(datasource)) {
      return of([]);
    }

    const panel: PanelModel = ({} as unknown) as PanelModel; // deliberate setting panel to empty object because executeAnnotationQuery shouldn't depend on panelModel

    return executeAnnotationQuery({ dashboard, range, panel }, datasource, annotation).pipe(
      map((result) => {
        return result.events ?? [];
      })
    );
  }
}
