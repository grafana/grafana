import { type AnnotationEvent, type DataFrame, toDataFrame } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { annotationK8sClient, resetAnnotationK8sClientForTests } from 'app/api/clients/annotation/v0alpha1';
import { type StateHistoryItem } from 'app/types/unified-alerting';

import { type AnnotationTagsResponse } from './types';

export interface AnnotationServer {
  query(params: Record<string, unknown>, requestId: string): Promise<DataFrame>;
  forAlert(alertUID: string): Promise<StateHistoryItem[]>;
  save(annotation: AnnotationEvent, scopes?: string[]): Promise<unknown>;
  update(annotation: AnnotationEvent, scopes?: string[]): Promise<unknown>;
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

/**
 * Hybrid server used when the `kubernetesAnnotations` feature toggle is enabled.
 *
 * Manual CRUD and tag autocomplete are routed to the new `annotation.grafana.app/v0alpha1`
 * k8s API. Reads (`query`, `forAlert`) are intentionally left on the legacy `/api/annotations`
 * endpoint until the custom `/search` route is wired up.
 */
class K8sAnnotationServer implements AnnotationServer {
  private legacy = new LegacyAnnotationServer();

  query(params: Record<string, unknown>, requestId: string): Promise<DataFrame> {
    return this.legacy.query(params, requestId);
  }

  forAlert(alertUID: string): Promise<StateHistoryItem[]> {
    return this.legacy.forAlert(alertUID);
  }

  save(annotation: AnnotationEvent, scopes?: string[]) {
    return annotationK8sClient.create(annotation, scopes);
  }

  update(annotation: AnnotationEvent, scopes?: string[]) {
    return annotationK8sClient.update(annotation, scopes);
  }

  delete(annotation: AnnotationEvent) {
    if (!annotation.id) {
      return Promise.reject(new Error('Annotation id is required to delete'));
    }
    return annotationK8sClient.remove(annotation.id);
  }

  async tags() {
    const items = await annotationK8sClient.tags();
    return items.map(({ name, count }) => ({ term: name, count }));
  }
}

let instance: AnnotationServer | null = null;

export function annotationServer(): AnnotationServer {
  if (!instance) {
    instance = config.featureToggles.kubernetesAnnotations ? new K8sAnnotationServer() : new LegacyAnnotationServer();
  }
  return instance;
}

/** @internal exposed for tests so the cached instance is rebuilt against the current config. */
export function resetAnnotationServerForTests() {
  instance = null;
  resetAnnotationK8sClientForTests();
}
