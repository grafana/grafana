import { Observable, from, retry, catchError, filter, map, mergeMap } from 'rxjs';

import { isLiveChannelMessageEvent, isLiveChannelStatusEvent, LiveChannelScope } from '@grafana/data/types';
import { config, getBackendSrv, getGrafanaLiveSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';

import { getAPINamespace } from '../../api/utils';

import {
  type ListOptions,
  type ListOptionsFieldSelector,
  type ListOptionsLabelSelector,
  type MetaStatus,
  type Resource,
  type ResourceForCreate,
  type ResourceList,
  type ResourceClient,
  type ObjectMeta,
  type WatchOptions,
  type K8sAPIGroupList,
  AnnoKeySavedFromUI,
  type ResourceEvent,
  type ResourceClientWriteParams,
  type GroupVersionResource,
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
    const selectors = this.getWatchSelectors(params);
    const requestParams = {
      watch: true,
      labelSelector: this.parseListOptionsSelector(selectors.labelSelector),
      fieldSelector: this.parseListOptionsSelector(selectors.fieldSelector),
    };

    // For now, watch over live only supports provisioning
    if (this.gvr.group === 'provisioning.grafana.app') {
      let query = '';
      if (requestParams.fieldSelector?.startsWith('metadata.name=')) {
        query = requestParams.fieldSelector.substring('metadata.name'.length);
      }
      return getGrafanaLiveSrv()
        .getStream<ResourceEvent<T, S, K>>({
          scope: LiveChannelScope.Watch,
          stream: this.gvr.group,
          path: `${this.gvr.version}/${this.gvr.resource}${query}/${contextSrv.user.uid || 'anonymous'}`,
          data: params?.resourceVersion ? { resourceVersion: params.resourceVersion } : undefined,
        })
        .pipe(
          map((event) => {
            if (isLiveChannelStatusEvent(event) && event.error) {
              throw event.error;
            }
            return event;
          }),
          filter((event) => isLiveChannelMessageEvent(event)),
          map((event) => event.message),
          catchError((error) => {
            console.warn('Live channel watch failed, falling back to polling:', error);
            return this.createPollingFallback(params, error);
          })
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
        map((response) => {
          if (!response.ok) {
            throw new Error(`Watch request failed with status ${response.status}: ${response.statusText}`);
          }
          return response;
        }),
        filter((response) => response.data instanceof Uint8Array),
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

  private static POLLING_INTERVAL_MS = 5000;
  private static MAX_CONSECUTIVE_POLL_FAILURES = 5;

  /**
   * Convert WatchOptions into the fieldSelector / labelSelector pair
   * used by both the live-channel watch request and the polling fallback.
   */
  private getWatchSelectors(params?: WatchOptions): Pick<ListOptions, 'fieldSelector' | 'labelSelector'> {
    const opts: Pick<ListOptions, 'fieldSelector' | 'labelSelector'> = {};
    if (params?.labelSelector) {
      opts.labelSelector = params.labelSelector;
    }
    if (params?.fieldSelector) {
      opts.fieldSelector = params.fieldSelector;
    }
    // WatchOptions.name overrides fieldSelector
    if (params?.name) {
      opts.fieldSelector = `metadata.name=${params.name}`;
    }
    return opts;
  }

  /**
   * Polling fallback when the Grafana Live WebSocket Observable errors.
   * Periodically calls list() and diffs against the previous snapshot to emit
   * ADDED / MODIFIED / DELETED events, providing eventual-state alignment.
   *
   * The first poll acts as a gate: if it fails, the original watch error is
   * surfaced to the subscriber (preventing silent infinite polling for hard
   * failures like auth errors). Subsequent poll failures are logged and retried.
   */
  private createPollingFallback(
    params: WatchOptions | undefined,
    originalError: unknown
  ): Observable<ResourceEvent<T, S, K>> {
    const listOpts = this.getWatchSelectors(params);

    return new Observable<ResourceEvent<T, S, K>>((subscriber) => {
      // NOTE: starting empty means the first poll can't detect items deleted between
      // the initial list() and polling start. Seeding from the RTKQ cache would fix
      // this but requires threading initial state through watch() → createPollingFallback.
      let previousItems = new Map<string, Resource<T, S, K>>();
      let active = true;
      let firstPoll = true;
      let timerId: ReturnType<typeof setTimeout> | null = null;
      let consecutiveFailures = 0;

      const poll = async () => {
        if (!active) {
          return;
        }
        try {
          const result = await this.list(listOpts);
          if (!active) {
            return;
          }

          const currentItems = new Map<string, Resource<T, S, K>>();
          for (const item of result.items) {
            currentItems.set(item.metadata.name, item);
          }

          // Emit ADDED or MODIFIED for items in current result
          for (const [name, item] of currentItems) {
            const prev = previousItems.get(name);
            if (!prev) {
              subscriber.next({ type: 'ADDED', object: item });
            } else if (prev.metadata.resourceVersion !== item.metadata.resourceVersion) {
              subscriber.next({ type: 'MODIFIED', object: item });
            }
          }

          // Emit DELETED for items no longer present
          for (const [name, item] of previousItems) {
            if (!currentItems.has(name)) {
              subscriber.next({ type: 'DELETED', object: item });
            }
          }

          previousItems = currentItems;
          firstPoll = false;
          consecutiveFailures = 0;
        } catch (pollError) {
          if (firstPoll) {
            // First poll failed too — this is likely a hard error (auth, bad endpoint).
            // Surface the original watch error rather than polling silently forever.
            subscriber.error(originalError);
            return;
          }
          consecutiveFailures++;
          if (consecutiveFailures >= ScopedResourceClient.MAX_CONSECUTIVE_POLL_FAILURES) {
            subscriber.error(pollError);
            return;
          }
          // Transient failure: log and retry next cycle.
          console.warn(
            `Polling fallback error (${consecutiveFailures}/${ScopedResourceClient.MAX_CONSECUTIVE_POLL_FAILURES}):`,
            pollError
          );
        }

        if (active) {
          timerId = setTimeout(poll, ScopedResourceClient.POLLING_INTERVAL_MS);
        }
      };

      // Start first poll immediately
      poll();

      // Teardown: stop polling when unsubscribed
      return () => {
        active = false;
        if (timerId !== null) {
          clearTimeout(timerId);
        }
      };
    });
  }
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
