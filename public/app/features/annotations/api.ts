import { type AnnotationEvent, type DataFrame, toDataFrame } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { annotationK8sClient } from 'app/api/clients/annotation/v0alpha1';
import { type StateHistoryItem } from 'app/types/unified-alerting';

import { isAnnotationApiAvailable } from './isAnnotationApiAvailable';
import { type AnnotationTagsResponse } from './types';

export interface AnnotationServer {
  query(params: Record<string, unknown>, requestId: string): Promise<DataFrame>;
  forAlert(alertUID: string): Promise<StateHistoryItem[]>;
  save(annotation: AnnotationEvent, scopes?: string[]): Promise<AnnotationEvent>;
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
 * The k8s annotations client is gated by the FE feature flag
 * (`grafana.kubernetesAnnotationsClient`) and presence of the `annotation.grafana.app`
 * group in the apiserver discovery list. Calling the new endpoints when the
 * group isn't registered would 404, so we require both signals before
 * switching off legacy. The discovery lookup is cached for the page lifetime
 * inside `isAnnotationApiAvailable`.
 */
export function isK8sAnnotationsClientEnabled(): Promise<boolean> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaKubernetesAnnotationsClient, false)) {
    return Promise.resolve(false);
  }
  return isAnnotationApiAvailable();
}

function fetchLegacyAlertAnnotations(params: Record<string, unknown>, requestId: string): Promise<AnnotationEvent[]> {
  // legacy is not scopes aware, remove them
  const { scopes, scopesMatchAny, ...rest } = params;
  return getBackendSrv().get<AnnotationEvent[]>('/api/annotations', { ...rest, type: 'alert' }, `${requestId}-alert`);
}

// Single server that dispatches each operation to either the k8s API or the
// legacy /api/annotations endpoint based on the runtime gate. `forAlert` is
// always legacy because the k8s /search endpoint cannot filter by alertUID.
class K8sAnnotationServer implements AnnotationServer {
  private legacy = new LegacyAnnotationServer();

  async query(params: Record<string, unknown>, requestId: string): Promise<DataFrame> {
    if (!(await isK8sAnnotationsClientEnabled())) {
      return this.legacy.query(params, requestId);
    }
    // The k8s annotation API does not serve alert-state annotations — so we also fire
    // the legacy one with type='alert' and merge results unless the type is specifically
    // scoped to only annotations.
    const wantsAlertAnnotations = params.type !== 'annotation';
    const [manualEvents, alertEvents] = await Promise.all([
      annotationK8sClient.search(params, requestId),
      wantsAlertAnnotations ? fetchLegacyAlertAnnotations(params, requestId) : Promise.resolve<AnnotationEvent[]>([]),
    ]);
    return toDataFrame([...manualEvents, ...alertEvents]);
  }

  forAlert(alertUID: string): Promise<StateHistoryItem[]> {
    return this.legacy.forAlert(alertUID);
  }

  async save(annotation: AnnotationEvent, scopes?: string[]) {
    if (!(await isK8sAnnotationsClientEnabled())) {
      return this.legacy.save(annotation);
    }
    return annotationK8sClient.create(annotation, scopes);
  }

  async update(annotation: AnnotationEvent, scopes?: string[]) {
    if (!(await isK8sAnnotationsClientEnabled())) {
      return this.legacy.update(annotation);
    }
    return annotationK8sClient.update(annotation, scopes);
  }

  async delete(annotation: AnnotationEvent) {
    if (!(await isK8sAnnotationsClientEnabled())) {
      return this.legacy.delete(annotation);
    }
    if (!annotation.id) {
      throw new Error('Annotation id is required to delete');
    }
    return annotationK8sClient.remove(annotation.id);
  }

  // Arrow-bound so `this` is preserved when callers pass it as a detached callback
  tags = async (): Promise<Array<{ term: string; count: number }>> => {
    if (!(await isK8sAnnotationsClientEnabled())) {
      return this.legacy.tags();
    }
    const items = await annotationK8sClient.tags();
    return items.map(({ tag, count }) => ({ term: tag, count }));
  };
}

let instance: AnnotationServer | null = null;

export function annotationServer(): AnnotationServer {
  if (!instance) {
    instance = new K8sAnnotationServer();
  }
  return instance;
}
