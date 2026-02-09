import { getBackendSrv } from '@grafana/runtime';

import { getAPINamespace } from '../../api/utils';
import { ScopedResourceClient } from '../apiserver/client';
import { Resource, ResourceClient, ResourceForCreate } from '../apiserver/types';

export interface AnnotationSpec {
  text: string;
  time: number;
  timeEnd?: number;
  dashboardUID?: string;
  panelID?: number;
  tags?: string[];
}

export type AnnotationResource = Resource<AnnotationSpec>;
export type AnnotationResourceForCreate = ResourceForCreate<AnnotationSpec>;

interface TagsResponse {
  tags: Array<{
    tag: string;
    count: number;
  }>;
}

export const K8S_ANNOTATION_API_CONFIG = {
  group: 'annotation.grafana.app',
  version: 'v0alpha1',
  resource: 'annotations',
} as const;

export class K8sAnnotationClient {
  private client: ResourceClient<AnnotationSpec>;

  constructor() {
    this.client = new ScopedResourceClient<AnnotationSpec>(K8S_ANNOTATION_API_CONFIG);
  }

  async getTags(limit = 1000): Promise<Array<{ tag: string; count: number }>> {
    // tags is a custom subresource, so we need to construct the URL manually
    const namespace = getAPINamespace();
    const url = `/apis/${K8S_ANNOTATION_API_CONFIG.group}/${K8S_ANNOTATION_API_CONFIG.version}/namespaces/${namespace}/tags`;

    const response = await getBackendSrv().get<TagsResponse>(url, { limit });
    return response.tags;
  }

  async query(params: Record<string, unknown>) {
    const fieldSelector = [];

    if (params.dashboardUID) {
      fieldSelector.push(`spec.dashboardUID=${params.dashboardUID}`);
    }

    if (params.panelID !== undefined) {
      fieldSelector.push(`spec.panelID=${params.panelID}`);
    }

    if (params.from !== undefined) {
      fieldSelector.push(`spec.time=${params.from}`);
    }

    if (params.to !== undefined) {
      fieldSelector.push(`spec.timeEnd=${params.to}`);
    }

    return this.client.list({
      fieldSelector: fieldSelector.length > 0 ? fieldSelector.join(',') : undefined,
      limit: params.limit ? Number(params.limit) : undefined,
    });
  }

  async get(name: string) {
    return this.client.get(name);
  }

  async create(obj: ResourceForCreate<AnnotationSpec>) {
    return this.client.create(obj);
  }

  async update(obj: Resource<AnnotationSpec>) {
    return this.client.update(obj);
  }

  async delete(name: string, showSuccessAlert = false) {
    return this.client.delete(name, showSuccessAlert);
  }
}
