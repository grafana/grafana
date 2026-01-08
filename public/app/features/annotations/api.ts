import { AnnotationEvent, DataFrame, toDataFrame } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { StateHistoryItem } from 'app/types/unified-alerting';

import { AnnotationTagsResponse } from './types';

export interface AnnotationServer {
  query(params: Record<string, unknown>, requestId: string): Promise<DataFrame>;
  forAlert(alertUID: string): Promise<StateHistoryItem[]>;
  save(annotation: AnnotationEvent): Promise<AnnotationEvent>;
  update(annotation: AnnotationEvent): Promise<unknown>;
  delete(annotation: AnnotationEvent): Promise<unknown>;
  tags(): Promise<Array<{ term: string; count: number }>>;
}

class LegacyAnnotationServer implements AnnotationServer {
  query(params: unknown, requestId: string): Promise<DataFrame> {
    return getBackendSrv()
      .get('/api/annotations', params, requestId)
      .then((v) => toDataFrame(v));
  }

  forAlert(alertUID: string) {
    return getBackendSrv().get('/api/annotations', {
      alertUID,
    });
  }

  save(annotation: AnnotationEvent) {
    return getBackendSrv().post('/api/annotations', annotation);
  }

  update(annotation: AnnotationEvent) {
    return getBackendSrv().put(`/api/annotations/${annotation.id}`, annotation);
  }

  delete(annotation: AnnotationEvent) {
    return getBackendSrv().delete(`/api/annotations/${annotation.id}`);
  }

  async tags() {
    const response = await getBackendSrv().get<AnnotationTagsResponse>('/api/annotations/tags?limit=1000');
    return response.result.tags.map(({ tag, count }) => ({
      term: tag,
      count,
    }));
  }
}

let instance: AnnotationServer | null = null;

export function annotationServer(): AnnotationServer {
  if (!instance) {
    instance = new LegacyAnnotationServer();
  }
  return instance;
}
