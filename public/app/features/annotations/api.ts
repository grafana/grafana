import { type AnnotationEvent, type DataFrame, toDataFrame } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { annotationK8sClient } from 'app/api/clients/annotation/v0alpha1';
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
 * The k8s annotations client is gated by both the FE feature flag
 * (`kubernetesAnnotationsClient`) and the backend's `annotationAppPlatformEnabled`
 * config. Calling the new endpoints when the backend hasn't installed the app
 * would 404, so we require both signals before switching off legacy.
 */
export function isK8sAnnotationsClientEnabled(): boolean {
  return Boolean(config.featureToggles.kubernetesAnnotationsClient) && Boolean(config.annotationAppPlatformEnabled);
}

// When isK8sAnnotationsClientEnabled() is true, CRUD/tags/query (dashboard annotations)
// go to annotation.grafana.app. forAlert stays on legacy because the new /search
// endpoint cannot filter by alertUID/type=alert (ListOptions has no Type/AlertUID).
class K8sAnnotationServer implements AnnotationServer {
  private legacy = new LegacyAnnotationServer();

  async query(params: Record<string, unknown>, requestId: string): Promise<DataFrame> {
    const events = await annotationK8sClient.search(params, requestId);
    return toDataFrame(events);
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
    return items.map(({ tag, count }) => ({ term: tag, count }));
  }
}

export function annotationServer(): AnnotationServer {
  return isK8sAnnotationsClientEnabled() ? new K8sAnnotationServer() : new LegacyAnnotationServer();
}
