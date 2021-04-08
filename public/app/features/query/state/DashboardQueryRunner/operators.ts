import { Observable, of } from 'rxjs';
import { AnnotationEvent } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';

import { dispatch } from 'app/store/store';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { DashboardQueryRunnerWorkerResult } from './types';

export function handleAnnotationQueryRunnerError(err: any): Observable<AnnotationEvent[]> {
  if (err.cancelled) {
    return of([]);
  }

  notifyWithError('AnnotationQueryRunner failed', err);
  return of([]);
}

export const emptyResult: () => Observable<DashboardQueryRunnerWorkerResult> = () =>
  of({ annotations: [], alertStates: [] });

export function handleDashboardQueryRunnerWorkerError(err: any): Observable<DashboardQueryRunnerWorkerResult> {
  if (err.cancelled) {
    return emptyResult();
  }

  notifyWithError('DashboardQueryRunner failed', err);
  return emptyResult();
}

function notifyWithError(title: string, err: any) {
  const error = toDataQueryError(err);
  console.error('handleAnnotationQueryRunnerError', error);
  const notification = createErrorNotification(title, error.message);
  dispatch(notifyApp(notification));
}
