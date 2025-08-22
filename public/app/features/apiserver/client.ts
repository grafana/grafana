import { Observable, from, retry, catchError, filter, map, mergeMap } from 'rxjs';

import { isLiveChannelMessageEvent, LiveChannelScope } from '@grafana/data';
import { config, getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { getAPINamespace } from '../../api/utils';

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
  WatchOptions,
  K8sAPIGroupList,
  AnnoKeySavedFromUI,
  ResourceEvent,
  ResourceClientWriteParams,
  GroupVersionResource,
} from './types';

export class ScopedResourceClient<T = object, S = object, K = string> implements ResourceClient<T, S, K> {
  readonly url: string;
  readonly gvr: GroupVersionResource;

  constructor(gvr: GroupVersionResource, namespaced = true) {
    const ns = namespaced ? `namespaces/${getAPINamespace()}/` : '';
    this.gvr = gvr;
    this.url = `/apis/${gvr.group}/${gvr.version}/${ns}${gvr.resource}`;
  }

  public async get(name: string): Promise<Resource<T, S, K>> {
    return getBackendSrv().get<Resource<T, S, K>>(`${this.url}/${name}`);
  }

  public watch(params?: WatchOptions): Observable<ResourceEvent<T, S, K>> {
    const requestParams = {
      watch: true,
      labelSelector: this.parseListOptionsSelector(params?.labelSelector),
      fieldSelector: this.parseListOptionsSelector(params?.fieldSelector),
    };
    if (params?.name) {
      requestParams.fieldSelector = `metadata.name=${params.name}`;
    }

    // For now, watch over live only supports provisioning
    if (this.gvr.group === 'provisioning.grafana.app') {
      let query = '';
      if (requestParams.fieldSelector?.startsWith('metadata.name=')) {
        query = requestParams.fieldSelector.substring('metadata.name'.length);
      }
      return getGrafanaLiveSrv()
        .getStream<ResourceEvent<T, S, K>>({
          scope: LiveChannelScope.Watch,
          namespace: this.gvr.group,
          path: `${this.gvr.version}/${this.gvr.resource}${query}/${contextSrv.user.uid}`,
        })
        .pipe(
          filter((event) => isLiveChannelMessageEvent(event)),
          map((event) => event.message)
        );
    }

    const decoder = new TextDecoder();
    return getBackendSrv()
      .chunked({
        url: this.url,
        params: requestParams,
        method: 'GET',
      })
      .pipe(
        filter((response) => response.ok && response.data instanceof Uint8Array),
        map((response) => {
          const text = decoder.decode(response.data);
          return text.split('\n');
        }),
        mergeMap((text) => from(text)),
        filter((line) => line.length > 0),
        map((line) => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.warn('Invalid JSON in watch stream:', e, line);
            return null;
          }
        }),
        filter((event): event is ResourceEvent<T, S, K> => event !== null),
        retry({ count: 3, delay: 1000 }),
        catchError((error) => {
          console.error('Watch stream error:', error);
          throw error;
        })
      );
  }

  public async subresource<S>(name: string, path: string, params?: Record<string, unknown>): Promise<S> {
    return getBackendSrv().get<S>(`${this.url}/${name}/${path}`, params);
  }

  public async list(opts?: ListOptions | undefined): Promise<ResourceList<T, S, K>> {
    const finalOpts = opts || {};
    finalOpts.labelSelector = this.parseListOptionsSelector(finalOpts?.labelSelector);
    finalOpts.fieldSelector = this.parseListOptionsSelector(finalOpts?.fieldSelector);

    return getBackendSrv().get<ResourceList<T, S, K>>(this.url, opts);
  }

  public async create(obj: ResourceForCreate<T, K>, params?: ResourceClientWriteParams): Promise<Resource<T, S, K>> {
    if (!obj.metadata.name && !obj.metadata.generateName) {
      const login = contextSrv.user.login;
      // GenerateName lets the apiserver create a unique name by appending random characters to the prefix.
      // This strips out special characters, numbers, and symbols to ensure a valid prefix.
      const alphabeticChars = login ? login.replace(/[^a-zA-Z]/g, '').slice(0, 2) : '';
      obj.metadata.generateName = alphabeticChars || 'g';
    }
    setSavedFromUIAnnotation(obj.metadata);
    return getBackendSrv().post(this.url, obj, {
      params,
    });
  }

  public async update(obj: Resource<T, S, K>, params?: ResourceClientWriteParams): Promise<Resource<T, S, K>> {
    setSavedFromUIAnnotation(obj.metadata);
    const url = `${this.url}/${obj.metadata.name}`;
    return getBackendSrv().put<Resource<T, S, K>>(url, obj, {
      params,
    });
  }

  public async delete(name: string, showSuccessAlert: boolean): Promise<MetaStatus> {
    return getBackendSrv().delete<MetaStatus>(`${this.url}/${name}`, undefined, {
      showSuccessAlert,
    });
  }

  private parseListOptionsSelector = parseListOptionsSelector;
}

// add the origin annotations so we know what was set from the UI
function setSavedFromUIAnnotation(meta: Partial<ObjectMeta>) {
  if (!meta.annotations) {
    meta.annotations = {};
  }
  meta.annotations[AnnoKeySavedFromUI] = config.buildInfo.versionString;
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

export const parseListOptionsSelector = (selector: ListOptionsLabelSelector | ListOptionsFieldSelector | undefined) => {
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
};
