import { AnnotationEvent, DataFrame, toDataFrame } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { StateHistoryItem } from 'app/types/unified-alerting';

import { k8sToLegacyAnnotation, legacyToK8sAnnotation } from './adapters';
import { AnnotationResource, K8sAnnotationClient } from './k8sAnnotationClient';
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

class K8sAnnotationServer implements AnnotationServer {
  private client = new K8sAnnotationClient();

  // TODO: do we need requestId here?
  async query(params: Record<string, unknown>): Promise<DataFrame> {
    if (params.alertId || params.alertUID || params.type === 'alert') {
      throw new Error(
        'Alerting annotations are not supported by the K8s API. Please use the legacy API for alerting annotations.'
      );
    }

    const list = await this.client.query({
      dashboardUID: params.dashboardUID,
      panelID: params.panelId,
      from: params.from,
      to: params.to,
      limit: params.limit,
    });

    let events = list.items.map(k8sToLegacyAnnotation);

    // filter by tags client-side since K8s API doesn't support it via field selectors
    if (params.tags && Array.isArray(params.tags) && params.tags.length > 0) {
      const tags = params.tags;
      const matchAny = params.matchAny === true;

      events = events.filter((event) => {
        if (!event.tags || event.tags.length === 0) {
          return false;
        }
        if (matchAny) {
          return tags.some((tag) => event.tags!.includes(tag));
        } else {
          return tags.every((tag) => event.tags!.includes(tag));
        }
      });
    }

    return toDataFrame(events);
  }

  async save(annotation: AnnotationEvent): Promise<AnnotationEvent> {
    const k8sObj = legacyToK8sAnnotation(annotation);
    const created = await this.client.create(k8sObj);
    return k8sToLegacyAnnotation(created);
  }

  async update(annotation: AnnotationEvent): Promise<AnnotationEvent> {
    if (!annotation.id) {
      throw new Error('Annotation ID is required for update');
    }

    // fetch existing to preserve metadata
    const existing = await this.client.get(`a-${annotation.id}`);

    const obj: AnnotationResource = {
      apiVersion: existing.apiVersion,
      kind: existing.kind,
      metadata: {
        ...existing.metadata,
      },
      spec: {
        // TODO: do we need to have all of these !== undefined checks?
        text: annotation.text !== undefined ? annotation.text : existing.spec.text,
        time: annotation.time !== undefined ? annotation.time : existing.spec.time,
        timeEnd: annotation.timeEnd !== undefined ? annotation.timeEnd : existing.spec.timeEnd,
        dashboardUID:
          annotation.dashboardUID !== undefined && annotation.dashboardUID !== null
            ? annotation.dashboardUID
            : existing.spec.dashboardUID,
        panelID: annotation.panelId !== undefined ? annotation.panelId : existing.spec.panelID,
        tags: annotation.tags !== undefined ? annotation.tags : existing.spec.tags,
      },
    };

    const updated = await this.client.update(obj);
    return k8sToLegacyAnnotation(updated);
  }

  async delete(annotation: AnnotationEvent): Promise<void> {
    if (!annotation.id) {
      throw new Error('Annotation ID is required for delete');
    }

    await this.client.delete(`a-${annotation.id}`, false);
  }

  async tags(): Promise<Array<{ term: string; count: number }>> {
    const tags = await this.client.getTags(1000);
    return tags.map((t) => ({ term: t.tag, count: t.count }));
  }

  // alerting annotations are not supported in K8s API
  forAlert(): Promise<StateHistoryItem[]> {
    throw new Error('forAlert is not supported by the K8s API. Please use the legacy API for alerting annotations.');
  }
}

// HybridAnnotationServer routes alerting-related calls to legacy and others to K8s
class HybridAnnotationServer implements AnnotationServer {
  private legacyServer = new LegacyAnnotationServer();
  private k8sServer = new K8sAnnotationServer();

  async query(params: Record<string, unknown>, requestId: string): Promise<DataFrame> {
    if (params.alertId || params.alertUID || params.type === 'alert') {
      return this.legacyServer.query(params, requestId);
    }

    return this.k8sServer.query(params);
  }

  async save(annotation: AnnotationEvent): Promise<AnnotationEvent> {
    return this.k8sServer.save(annotation);
  }

  async update(annotation: AnnotationEvent): Promise<unknown> {
    return this.k8sServer.update(annotation);
  }

  async delete(annotation: AnnotationEvent): Promise<unknown> {
    return this.k8sServer.delete(annotation);
  }

  async tags(): Promise<Array<{ term: string; count: number }>> {
    return this.k8sServer.tags();
  }

  async forAlert(alertUID: string): Promise<StateHistoryItem[]> {
    return this.legacyServer.forAlert(alertUID);
  }
}

let instance: AnnotationServer | null = null;

export function annotationServer(): AnnotationServer {
  if (!instance) {
    if (config.featureToggles.kubernetesAnnotations) {
      instance = new HybridAnnotationServer();
    } else {
      instance = new LegacyAnnotationServer();
    }
  }
  return instance;
}
