import { config, getBackendSrv } from '@grafana/runtime';

import {
  ListOptions,
  ListOptionsFieldSelector,
  ListOptionsLabelSelector,
  MetaStatus,
  Resource,
  ResourceForCreate,
  ResourceList,
  ResourceClient,
} from './types';

export interface GroupVersionResource {
  group: string;
  version: string;
  resource: string;
}

export class ScopedResourceClient<T = object, K = string> implements ResourceClient<T, K> {
  readonly url: string;

  constructor(gvr: GroupVersionResource, namespaced = true) {
    const ns = namespaced ? `namespaces/${config.namespace}/` : '';

    this.url = `/apis/${gvr.group}/${gvr.version}/${ns}${gvr.resource}`;
  }

  public async create(obj: ResourceForCreate<T, K>): Promise<void> {
    if (!obj.metadata.name && !obj.metadata.generateName) {
      obj.metadata.generateName = 'g'; // Triggers the server to create a unique value
    }
    return getBackendSrv().post(this.url, obj);
  }

  public async get(name: string): Promise<Resource<T, K>> {
    return getBackendSrv().get<Resource<T, K>>(`${this.url}/${name}`);
  }

  public async subresource<S>(name: string, path: string): Promise<S> {
    return getBackendSrv().get<S>(`${this.url}/${name}/${path}`);
  }

  public async list(opts?: ListOptions | undefined): Promise<ResourceList<T, K>> {
    const finalOpts = opts || {};
    finalOpts.labelSelector = this.parseListOptionsSelector(finalOpts?.labelSelector);
    finalOpts.fieldSelector = this.parseListOptionsSelector(finalOpts?.fieldSelector);

    return getBackendSrv().get<ResourceList<T, K>>(this.url, opts);
  }

  public async update(obj: Resource<T, K>): Promise<Resource<T, K>> {
    return getBackendSrv().put<Resource<T, K>>(`${this.url}/${obj.metadata.name}`, obj);
  }

  public async delete(name: string): Promise<MetaStatus> {
    return getBackendSrv().delete<MetaStatus>(`${this.url}/${name}`);
  }

  private parseListOptionsSelector(
    selector: ListOptionsLabelSelector | ListOptionsFieldSelector | undefined
  ): string | undefined {
    if (!Array.isArray(selector)) {
      return selector;
    }

    return selector
      .map((label) => {
        const key = String(label.key);
        const operator = label.operator;

        switch (operator) {
          case '=':
          case '!=':
            return `${key}${operator}${label.value}`;

          case 'in':
          case 'notin':
            return `${key} ${operator} (${label.value.join(',')})`;

          case '':
          case '!':
            return `${operator}${key}`;

          default:
            return null;
        }
      })
      .filter(Boolean)
      .join(',');
  }
}
