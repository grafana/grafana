import { config, getBackendSrv } from '@grafana/runtime';

import { ListOptions, MetaStatus, Resource, ResourceForCreate, ResourceList, ResourceServer } from './types';

export interface GroupVersionResource {
  group: string;
  version: string;
  resource: string;
}

export class ScopedResourceServer<T = object> implements ResourceServer<T> {
  readonly url: string;

  constructor(gvr: GroupVersionResource, namespaced = true) {
    let ns = namespaced ? `namespaces/${config.namespace}/` : '';
    this.url = `/apis/${gvr.group}/${gvr.version}/${ns}${gvr.resource}`;
  }

  async create(obj: ResourceForCreate<T>): Promise<void> {
    return getBackendSrv().post(this.url, obj);
  }

  async get(name: string): Promise<Resource<T>> {
    return getBackendSrv().get<Resource<T>>(`${this.url}/${name}`);
  }

  async list(opts?: ListOptions | undefined): Promise<ResourceList<T>> {
    return getBackendSrv().get<ResourceList<T>>(this.url);
  }

  async update(obj: Resource<T>): Promise<Resource<T>> {
    return getBackendSrv().put<Resource<T>>(`${this.url}/${obj.metadata.name}`, obj);
  }

  async delete(name: string): Promise<MetaStatus> {
    return getBackendSrv().delete<MetaStatus>(`${this.url}/${name}`);
  }
}
