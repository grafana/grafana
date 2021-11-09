import { cloneDeep } from 'lodash';
import { Observable, of } from 'rxjs';
import { map, mergeMap } from 'rxjs/operators';
import {
  AnnotationEvent,
  CoreApp,
  DataQueryRequest,
  DataSourceApi,
  deprecationWarning,
  rangeUtil,
  ScopedVars,
} from '@grafana/data';

import coreModule from 'app/angular/core_module';
import { AnnotationQueryOptions, AnnotationQueryResponse } from './types';
import { standardAnnotationSupport } from './standardAnnotationSupport';
import { runRequest } from '../query/state/runRequest';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from './api';

let counter = 100;
function getNextRequestId() {
  return 'AQ' + counter++;
}
/**
 * @deprecated AnnotationsSrv is deprecated in favor of DashboardQueryRunner
 */
export class AnnotationsSrv {
  /**
   * @deprecated clearPromiseCaches is deprecated
   */
  clearPromiseCaches() {
    deprecationWarning('annotations_srv.ts', 'clearPromiseCaches', 'DashboardQueryRunner');
  }

  /**
   * @deprecated getAnnotations is deprecated in favor of DashboardQueryRunner.getResult
   */
  getAnnotations(options: AnnotationQueryOptions) {
    deprecationWarning('annotations_srv.ts', 'getAnnotations', 'DashboardQueryRunner.getResult');
    return Promise.resolve({ annotations: [], alertState: undefined });
  }

  /**
   * @deprecated getAlertStates is deprecated in favor of DashboardQueryRunner.getResult
   */
  getAlertStates(options: any) {
    deprecationWarning('annotations_srv.ts', 'getAlertStates', 'DashboardQueryRunner.getResult');
    return Promise.resolve(undefined);
  }

  /**
   * @deprecated getGlobalAnnotations is deprecated in favor of DashboardQueryRunner.getResult
   */
  getGlobalAnnotations(options: AnnotationQueryOptions) {
    deprecationWarning('annotations_srv.ts', 'getGlobalAnnotations', 'DashboardQueryRunner.getResult');
    return Promise.resolve([]);
  }

  /**
   * @deprecated saveAnnotationEvent is deprecated
   */
  saveAnnotationEvent(annotation: AnnotationEvent) {
    deprecationWarning('annotations_srv.ts', 'saveAnnotationEvent', 'api/saveAnnotation');
    return saveAnnotation(annotation);
  }

  /**
   * @deprecated updateAnnotationEvent is deprecated
   */
  updateAnnotationEvent(annotation: AnnotationEvent) {
    deprecationWarning('annotations_srv.ts', 'updateAnnotationEvent', 'api/updateAnnotation');
    return updateAnnotation(annotation);
  }

  /**
   * @deprecated deleteAnnotationEvent is deprecated
   */
  deleteAnnotationEvent(annotation: AnnotationEvent) {
    deprecationWarning('annotations_srv.ts', 'deleteAnnotationEvent', 'api/deleteAnnotation');
    return deleteAnnotation(annotation);
  }

  /**
   * @deprecated translateQueryResult is deprecated in favor of DashboardQueryRunner/utils/translateQueryResult
   */
  translateQueryResult(annotation: any, results: any) {
    deprecationWarning('annotations_srv.ts', 'translateQueryResult', 'DashboardQueryRunner/utils/translateQueryResult');
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
      item.isRegion = item.timeEnd && item.time !== item.timeEnd;
    }

    return results;
  }
}

export function executeAnnotationQuery(
  options: AnnotationQueryOptions,
  datasource: DataSourceApi,
  savedJsonAnno: any
): Observable<AnnotationQueryResponse> {
  const processor = {
    ...standardAnnotationSupport,
    ...datasource.annotations,
  };

  const annotation = processor.prepareAnnotation!(savedJsonAnno);
  if (!annotation) {
    return of({});
  }

  const query = processor.prepareQuery!(annotation);
  if (!query) {
    return of({});
  }

  // No more points than pixels
  const maxDataPoints = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

  // Add interval to annotation queries
  const interval = rangeUtil.calculateInterval(options.range, maxDataPoints, datasource.interval);

  const scopedVars: ScopedVars = {
    __interval: { text: interval.interval, value: interval.interval },
    __interval_ms: { text: interval.intervalMs.toString(), value: interval.intervalMs },
    __annotation: { text: annotation.name, value: annotation },
  };

  const queryRequest: DataQueryRequest = {
    startTime: Date.now(),
    requestId: getNextRequestId(),
    range: options.range,
    maxDataPoints,
    scopedVars,
    ...interval,
    app: CoreApp.Dashboard,

    timezone: options.dashboard.timezone,

    targets: [
      {
        ...query,
        refId: 'Anno',
      },
    ],
  };

  return runRequest(datasource, queryRequest).pipe(
    mergeMap((panelData) => {
      if (!panelData.series) {
        return of({ panelData, events: [] });
      }

      return processor.processEvents!(annotation, panelData.series).pipe(map((events) => ({ panelData, events })));
    })
  );
}

coreModule.service('annotationsSrv', AnnotationsSrv);
