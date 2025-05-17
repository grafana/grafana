import { lastValueFrom, map } from 'rxjs';

import { FetchResponse, getBackendSrv } from '@grafana/runtime';

import { GroupVersionKind, ListMeta } from './types';

export type GroupDiscoveryResource = {
  resource: string;
  responseKind: GroupVersionKind;
  scope: 'Namespaced' | 'Cluster';
  singularResource: string;
  verbs: string[];
  subresources?: GroupDiscoverySubresource[];
};

export type GroupDiscoverySubresource = {
  subresource: string;
  responseKind: GroupVersionKind;
  verbs: string[];
};

export type GroupDiscoveryVersion = {
  version: string;
  freshness: 'Current' | string;
  resources: GroupDiscoveryResource[];
};

export type GroupDiscoveryItem = {
  metadata: {
    name: string;
  };
  versions: GroupDiscoveryVersion[];
};

export type APIGroupDiscoveryList = {
  metadata: ListMeta;
  items: GroupDiscoveryItem[];
};

export async function getAPIGroupDiscoveryList(): Promise<APIGroupDiscoveryList> {
  return await lastValueFrom(
    getBackendSrv()
      .fetch<APIGroupDiscoveryList>({
        method: 'GET',
        url: '/apis',
        headers: {
          Accept:
            'application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList,application/json;g=apidiscovery.k8s.io;v=v2beta1;as=APIGroupDiscoveryList,application/json',
        },
      })
      .pipe(
        map((response: FetchResponse<APIGroupDiscoveryList>) => {
          // Fill in the group+version before returning
          for (let api of response.data.items) {
            for (let version of api.versions) {
              for (let resource of version.resources) {
                resource.responseKind.group = api.metadata.name;
                resource.responseKind.version = version.version;
                if (resource.subresources) {
                  for (let sub of resource.subresources) {
                    sub.responseKind.group = api.metadata.name;
                    sub.responseKind.version = version.version;
                  }
                }
              }
            }
          }
          return response.data;
        })
      )
  );
}

export function discoveryResources(apis: APIGroupDiscoveryList): GroupDiscoveryResource[] {
  const resources: GroupDiscoveryResource[] = [];
  for (let api of apis.items) {
    for (let version of api.versions) {
      for (let resource of version.resources) {
        resources.push(resource);
      }
    }
  }
  return resources;
}
