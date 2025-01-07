import { Observable, Subscriber, map, switchMap, of } from 'rxjs';
import { fromFetch } from 'rxjs/fetch';

import { config, FetchResponse, getBackendSrv } from '@grafana/runtime';
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

  public watch(name?: string): Observable<ResourceEvent<T, S, K>> {
    if (true) {
      const url = name ? `${this.url}/${name}` : this.url;
      console.log( "WATCH", url);

      return fromFetch(url + '?watch=true', {
        // selector: response => {
        //   response.
        //   console.log("PAGE", response);
        //   return response.json().then(v => {
        //     console.log("JJJSON", v);
        //     return v
        //   })
        // }
      }).pipe( switchMap(v => {
        console.log( "GOT", v);

        if (v.body) {
          return fromReadableStream(v.body).pipe(map(b => {
            const buff = new TextDecoder().decode(b);
            const parts = buff.split('\n'); // NOT RIGHT... need streaming parser???

            for(let x of parts ) {
              console.log(">", x)
            }

            const out = JSON.parse(parts[0]);
            return out;
          }))
        }

      //  v.body?.getReader()


        return of({
          type: 'ADDED',
          object: {
            apiVersion: 'XXX',
          }
        } as any)
      }))
    }


    return getBackendSrv()
      .fetch({
        url: name ? `${this.url}/${name}` : this.url,
        params: {
          watch: true,
        },
      })
      .pipe(
        map((result: FetchResponse<any>) => {
          console.log('GOT', result);
          return {
            type: 'ADDED',
            object: {
              apiVersion: 'xxx',
            } as any,
          };
        })
        // catchError((err) => {
        //   if (err.cancelled) {
        //     return of(err);
        //   }

        //   return of();
        // })
      );
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
  throwEndAsError = false,
): Observable<T> {
  /**
   * @private
   * @internal
   * @param subscriber
   */
  function createStream(subscriber: Subscriber<T>) {
    return new WritableStream<T>(
      {
        write: (value) => subscriber.next(value),
        abort: (error) => {
          if (throwEndAsError) {
            subscriber.error(error);
            /* istanbul ignore next-line */
          } else if (!subscriber.closed) {
            subscriber.complete();
          }
        },
        close: () => {
          /* istanbul ignore next-line */
          if (!subscriber.closed) {
            subscriber.complete();
          }
        },
      },
      queueStrategy,
    );
  }

  return new Observable<T>((subscriber) => {
    stream
      .pipeTo(createStream(subscriber), { signal })
      .then(() => {
        /* istanbul ignore next-line */
        return !subscriber.closed && subscriber.complete();
      })
      .catch((error) => subscriber.error(error));

    return () => !stream.locked && stream.cancel();
  });
}
