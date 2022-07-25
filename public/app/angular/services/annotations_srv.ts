import { cloneDeep } from 'lodash';

import { AnnotationEvent, deprecationWarning } from '@grafana/data';
import { deleteAnnotation, saveAnnotation, updateAnnotation } from 'app/features/annotations/api';
import { AnnotationQueryOptions } from 'app/features/annotations/types';

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
