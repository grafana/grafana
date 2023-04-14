import { asyncScheduler, Observable, of, scheduled } from 'rxjs';

import { AnnotationEvent, getDefaultTimeRange } from '@grafana/data';

import { DashboardQueryRunnerOptions } from './types';

// function that creates an async of result Observable
export function toAsyncOfResult(result: any): Observable<any> {
  return scheduled(of(result), asyncScheduler);
}

export const LEGACY_DS_NAME = 'Legacy';
export const NEXT_GEN_DS_NAME = 'NextGen';

function getSnapshotData(annotation: any): AnnotationEvent[] {
  return [{ annotation, source: {}, timeEnd: 2, time: 1 }];
}

function getAnnotation({
  enable = true,
  useSnapshotData = false,
  datasource = LEGACY_DS_NAME,
}: { enable?: boolean; useSnapshotData?: boolean; datasource?: string } = {}) {
  const annotation = {
    id: useSnapshotData ? 'Snapshotted' : undefined,
    enable,
    hide: false,
    name: 'Test',
    iconColor: 'pink',
    datasource,
  };

  return {
    ...annotation,
    snapshotData: useSnapshotData ? getSnapshotData(annotation) : undefined,
  };
}

export function getDefaultOptions(): DashboardQueryRunnerOptions {
  const legacy = getAnnotation({ datasource: LEGACY_DS_NAME });
  const nextGen = getAnnotation({ datasource: NEXT_GEN_DS_NAME });
  const dashboard: any = {
    id: 1,
    annotations: {
      list: [
        legacy,
        nextGen,
        getAnnotation({ enable: false }),
        getAnnotation({ useSnapshotData: true }),
        getAnnotation({ enable: false, useSnapshotData: true }),
      ],
    },
    events: {
      subscribe: jest.fn().mockReturnValue({ unsubscribe: jest.fn() }),
      publish: jest.fn(),
    },
    panels: [{ alert: {} } as any],
    meta: {
      publicDashboardAccessToken: '',
    },
  };
  const range = getDefaultTimeRange();

  return { dashboard, range };
}
