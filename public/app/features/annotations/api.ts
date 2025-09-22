import { AnnotationEvent, DataFrame, toDataFrame } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';

import { AnnotationTagsResponse } from './types';

export interface AnnotationService {
  forAlert(alertUID: string): Promise<AnnotationEvent[]>;
  saveAnnotation(annotation: AnnotationEvent): Promise<AnnotationEvent>;
  updateAnnotation(annotation: AnnotationEvent): Promise<unknown>;
  deleteAnnotation(annotation: AnnotationEvent): Promise<unknown>;
  query(params: Record<string, unknown>, requestId: string): Promise<DataFrame>;
  getTags(): Promise<Array<{ term: string; count: number }>>;
}

class LegacyAnnotationService implements AnnotationService {
  query(params: unknown, requestId: string): Promise<DataFrame> {
    return getBackendSrv()
      .get('/api/annotations', params, requestId)
      .then((result) => {
        return toDataFrame(result);
      });
  }

  forAlert(alertUID: string) {
    return getBackendSrv().get('/api/annotations', {
      alertUID,
    });
  }

  saveAnnotation(annotation: AnnotationEvent) {
    return getBackendSrv().post('/api/annotations', annotation);
  }

  updateAnnotation(annotation: AnnotationEvent) {
    return getBackendSrv().put(`/api/annotations/${annotation.id}`, annotation);
  }

  deleteAnnotation(annotation: AnnotationEvent) {
    return getBackendSrv().delete(`/api/annotations/${annotation.id}`);
  }

  async getTags() {
    const response = await getBackendSrv().get<AnnotationTagsResponse>('/api/annotations/tags');
    return response.result.tags.map(({ tag, count }) => ({
      term: tag,
      count,
    }));
  }
}

export const annotations = new LegacyAnnotationService();
