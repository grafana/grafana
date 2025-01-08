import { Observable, Subscriber, map, switchMap, from, filter, retry, catchError } from 'rxjs';

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
  K8sAPIGroupList,
  AnnoKeySavedFromUI,
  ResourceEvent,
} from './types';

export interface GroupVersionResource {
  group: string;
  version: string;
  resource: string;
}

export class ScopedResourceClient<T = object, S = object, K = string> implements ResourceClient<T, S, K> {
  readonly url: string;

  constructor(gvr: GroupVersionResource, namespaced = true) {
    const ns = namespaced ? `namespaces/${config.namespace}/` : '';

    this.url = `/apis/${gvr.group}/${gvr.version}/${ns}${gvr.resource}`;
  }

  public async get(name: string): Promise<Resource<T, S, K>> {
    return getBackendSrv().get<Resource<T, S, K>>(`${this.url}/${name}`);
  }

  public watch(name?: string, resourceVersion?: string): Observable<ResourceEvent<T, S, K>> {
    return this.createWatchRequest(name, resourceVersion).pipe(
      switchMap((response) => this.handleWatchStream(response)),
      retry({ count: 3, delay: 1000 }),
      catchError((error) => {
        console.error('Watch stream error:', error);
        throw error;
      })
    );
  }

  private createWatchRequest(name?: string, resourceVersion?: string) {
    return getBackendSrv().fetch<ReadableStream<Uint8Array>>({
      url: name ? `${this.url}/${name}` : this.url,
      params: {
        watch: true,
        resourceVersion,
      },
      responseType: 'stream',
    });
  }

  private handleWatchStream(result: { data: ReadableStream<Uint8Array> }): Observable<ResourceEvent<T, S, K>> {
    const decoder = new TextDecoder();
    let buffer = '';

    return fromReadableStream(result.data).pipe(
      map((chunk) => decoder.decode(chunk, { stream: true })),
      map((text) => {
        buffer += text;
        const events: Array<ResourceEvent<T, S, K>> = [];

        // Find complete JSON objects in the buffer
        let startIndex = buffer.indexOf('{');
        while (startIndex !== -1) {
          try {
            const endIndex = this.findJsonEnd(buffer, startIndex);
            if (endIndex === -1) {
              break;
            }

            const jsonStr = buffer.substring(startIndex, endIndex + 1);
            const event = JSON.parse(jsonStr) as ResourceEvent<T, S, K>;
            events.push(event);

            // Remove processed data from buffer
            buffer = buffer.substring(endIndex + 1);
            startIndex = buffer.indexOf('{');
          } catch (e) {
            // If JSON.parse fails, move to next potential object
            buffer = buffer.substring(startIndex + 1);
            startIndex = buffer.indexOf('{');
          }
        }

        return events;
      }),
      filter((events) => events.length > 0),
      switchMap((events) => from(events))
    );
  }

  private findJsonEnd(str: string, startIndex: number): number {
    let brackets = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < str.length; i++) {
      const char = str[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          brackets++;
        }
        if (char === '}') {
          brackets--;
          if (brackets === 0) {
            return i;
          }
        }
      }
    }

    return -1;
  }

  public async subresource<S>(name: string, path: string): Promise<S> {
    return getBackendSrv().get<S>(`${this.url}/${name}/${path}`);
  }

  public async list(opts?: ListOptions | undefined): Promise<ResourceList<T, S, K>> {
    const finalOpts = opts || {};
    finalOpts.labelSelector = this.parseListOptionsSelector(finalOpts?.labelSelector);
    finalOpts.fieldSelector = this.parseListOptionsSelector(finalOpts?.fieldSelector);

    return getBackendSrv().get<ResourceList<T, S, K>>(this.url, opts);
  }

  public async create(obj: ResourceForCreate<T, K>): Promise<Resource<T, S, K>> {
    if (!obj.metadata.name && !obj.metadata.generateName) {
      const login = contextSrv.user.login;
      // GenerateName lets the apiserver create a new uid for the name
      // THe passed in value is the suggested prefix
      obj.metadata.generateName = login ? login.slice(0, 2) : 'g';
    }
    setSavedFromUIAnnotation(obj.metadata);
    return getBackendSrv().post(this.url, obj);
  }

  public async update(obj: Resource<T, S, K>): Promise<Resource<T, S, K>> {
    setSavedFromUIAnnotation(obj.metadata);
    return getBackendSrv().put<Resource<T, S, K>>(`${this.url}/${obj.metadata.name}`, obj);
  }

  public async delete(name: string): Promise<MetaStatus> {
    return getBackendSrv().delete<MetaStatus>(`${this.url}/${name}`);
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

/**
 * Creates an Observable source from a ReadableStream source that will emit any
 * values emitted by the stream.
 *
 * https://github.com/rxjs-ninja/rxjs-ninja/blob/main/libs/rxjs/utility/src/lib/from-readable-stream.ts
 */
function fromReadableStream<T extends unknown>(
  stream: ReadableStream<T>,
  signal?: AbortSignal,
  queueStrategy?: QueuingStrategy,
  throwEndAsError = false
): Observable<T> {
  function createStream(subscriber: Subscriber<T>) {
    return new WritableStream<T>(
      {
        write: (value) => subscriber.next(value),
        abort: (error) => {
          if (throwEndAsError) {
            subscriber.error(error);
          } else if (!subscriber.closed) {
            subscriber.complete();
          }
        },
        close: () => {
          if (!subscriber.closed) {
            subscriber.complete();
          }
        },
      },
      queueStrategy
    );
  }

  return new Observable<T>((subscriber) => {
    stream
      .pipeTo(createStream(subscriber), { signal })
      .then(() => {
        return !subscriber.closed && subscriber.complete();
      })
      .catch((error) => subscriber.error(error));

    return () => !stream.locked && stream.cancel();
  });
}
