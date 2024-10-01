import { config, getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import {
  ListOptions,
  ListOptionsFieldSelector,
  ListOptionsLabelSelector,
  MetaStatus,
  Resource,
  ResourceForCreate,
  ResourceList,
  ResourceClient,
  ObjectMeta,
  AnnoKeyOriginPath,
  AnnoKeyOriginHash,
  AnnoKeyOriginName,
  K8sAPIGroupList,
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

  public async create(obj: ResourceForCreate<T, K>): Promise<Resource<T, K>> {
    if (!obj.metadata.name && !obj.metadata.generateName) {
      const login = contextSrv.user.login;
      // GenerateName lets the apiserver create a new uid for the name
      // THe passed in value is the suggested prefix
      obj.metadata.generateName = login ? login.slice(0, 2) : 'g';
    }
    setOriginAsUI(obj.metadata);
    return getBackendSrv().post(this.url, obj);
  }

  public async update(obj: Resource<T, K>): Promise<Resource<T, K>> {
    setOriginAsUI(obj.metadata);
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

// add the origin annotations so we know what was set from the UI
function setOriginAsUI(meta: Partial<ObjectMeta>) {
  if (!meta.annotations) {
    meta.annotations = {};
  }
  meta.annotations[AnnoKeyOriginName] = 'UI';
  meta.annotations[AnnoKeyOriginPath] = window.location.pathname;
  meta.annotations[AnnoKeyOriginHash] = config.buildInfo.versionString;
}

export class DatasourceAPIVersions {
  private apiVersions?: { [pluginID: string]: string };

  async get(pluginID: string): Promise<string | undefined> {
    if (this.apiVersions) {
      return this.apiVersions[pluginID];
    }
    const apis = await getBackendSrv().get<K8sAPIGroupList>('/apis');
    const apiVersions: { [pluginID: string]: string } = {};
    apis.groups.forEach((group) => {
      if (group.name.includes('datasource.grafana.app')) {
        const id = group.name.split('.')[0];
        apiVersions[id] = group.preferredVersion.version;
        // workaround for plugins that don't append '-datasource' for the group name
        // e.g. org-plugin-datasource uses org-plugin.datasource.grafana.app
        if (!id.endsWith('-datasource')) {
          if (!id.includes('-')) {
            // workaroud for Grafana plugins that don't include the org either
            // e.g. testdata uses testdata.datasource.grafana.app
            apiVersions[`grafana-${id}-datasource`] = group.preferredVersion.version;
          } else {
            apiVersions[`${id}-datasource`] = group.preferredVersion.version;
          }
        }
      }
    });
    this.apiVersions = apiVersions;
    return apiVersions[pluginID];
  }
}
