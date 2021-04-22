import { Observable, of } from 'rxjs';
import { AnnotationEvent, AnnotationQuery } from '@grafana/data';
import { toDataQueryError } from '@grafana/runtime';

import { dispatch } from 'app/store/store';
import { createErrorNotification } from '../../../../core/copy/appNotification';
import { notifyApp } from '../../../../core/reducers/appNotification';
import { DashboardQueryRunnerWorkerResult } from './types';
import { cloneDeep } from 'lodash';

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

export function getAnnotationsByPanelId(annotations: AnnotationEvent[], panelId?: number) {
  return annotations.filter((item) => {
    if (panelId !== undefined && item.panelId && item.source?.type === 'dashboard') {
      return item.panelId === panelId;
    }
    return true;
  });
}

export function translateQueryResult(annotation: AnnotationQuery, results: AnnotationEvent[]): AnnotationEvent[] {
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
