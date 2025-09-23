import { AnnotationEvent, DataFrame, toDataFrame } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { StateHistoryItem } from 'app/types/unified-alerting';

import { AnnotationTag, AnnotationTagsResponse } from './types';

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
    const response = await getBackendSrv().get<AnnotationTagsResponse>('/api/annotations/tags');
    return response.result.tags.map(({ tag, count }) => ({
      term: tag,
      count,
    }));
  }
}

class APIServerAnnotationServer implements AnnotationServer {
  private url: string;

  constructor() {
    this.url = `/apis/annotation.grafana.app/v0alpha1/namespaces/${config.namespace}/annotations`;
  }

  query(params: unknown, requestId: string): Promise<DataFrame> {
    return getBackendSrv()
      .get(this.url + '/query', params, requestId)
      .then((v) => toDataFrame(v));
  }

  forAlert(alertUID: string) {
    return getBackendSrv().get(
      this.url + '/query',
      {
        alertUID,
        format: 'legacyEvent', // the legacy DTO format
      },
      'alert-query'
    );
  }

  save(annotation: AnnotationEvent) {
    const spec: Record<string, unknown> = {
      text: annotation.text,
      epoch: annotation.time,
      dashboard: {
        name: annotation.dashboardUID,
        panel: annotation.panelId,
      },
    };
    if (annotation.isRegion) {
      spec.epochEnd = annotation.timeEnd;
    }
    if (annotation.tags?.length) {
      spec.tags = annotation.tags;
    }
    return getBackendSrv().post(this.url, {
      metadata: {
        generateName: 'a',
      },
      spec,
    });
  }

  // NOTE: update adds a new annotation and deletes the old one
  async update(annotation: AnnotationEvent) {
    const created = await this.save(annotation);
    await this.delete(annotation);
    return created;
  }

  delete(annotation: AnnotationEvent) {
    return getBackendSrv().delete(`${this.url}/${annotation.id}`);
  }

  async tags() {
    const response = await getBackendSrv().get<{
      items: AnnotationTag[];
    }>(this.url + '/tags');
    return response.items.map(({ tag, count }) => ({
      term: tag,
      count,
    }));
  }
}

let instance: AnnotationServer | null = null;

export function annotationServer(): AnnotationServer {
  if (!instance) {
    instance = config.featureToggles.annotationsFromAPIServer
      ? new APIServerAnnotationServer()
      : new LegacyAnnotationServer();
  }
  return instance;
}
