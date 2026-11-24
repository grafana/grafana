import { isObject } from '@grafana/data';

import {
  type APIResourceInfo,
  type K8sAPIGroupDiscovery,
  type K8sAPIGroupDiscoveryList,
  type K8sAPIResource,
  type K8sAPIResourceDiscovery,
  type K8sAPIResourceList,
  type K8sAPISubresourceDiscovery,
  type K8sAPIVersionDiscovery,
} from './types';

export interface ResourceList {
  resources: readonly APIResourceInfo[];
  verbs: ReadonlyMap<string, readonly string[]>;
}

type ResourceBuilder = APIResourceInfo & { subresources: string[] };

export function fromK8sAPIResourceList(group: string, version: string, list: K8sAPIResourceList): ResourceList {
  const resources = new Map<string, ResourceBuilder>();
  const verbs = new Map<string, readonly string[]>();

  for (const { name, kind = '', namespaced = false, verbs: resourceVerbs } of list.resources) {
    if (!name.includes('/') && !resources.has(name)) {
      resources.set(name, {
        group,
        version,
        resource: name,
        kind,
        namespaced,
        verbs: resourceVerbs ?? [],
        subresources: [],
      });
      verbs.set(name, resourceVerbs ?? []);
    }
  }

  for (const { name, namespaced = false, verbs: subresourceVerbs } of list.resources) {
    const slash = name.indexOf('/');
    if (slash === -1) {
      continue;
    }
    const resource = name.slice(0, slash);
    let parent = resources.get(resource);
    if (!parent) {
      parent = { group, version, resource, kind: '', namespaced, verbs: [], subresources: [] };
      resources.set(resource, parent);
      verbs.set(resource, []);
    }
    parent.subresources.push(name.slice(slash + 1));
    verbs.set(name, subresourceVerbs ?? []);
  }

  return { resources: [...resources.values()], verbs };
}

export function fromK8sAPIGroupDiscoveryList(list: K8sAPIGroupDiscoveryList): APIResourceInfo[] {
  return list.items.flatMap(({ metadata, versions }) =>
    (versions ?? []).flatMap(({ version, resources }) =>
      (resources ?? []).map(({ resource, responseKind, scope, verbs, subresources }) => ({
        group: metadata.name,
        version,
        resource,
        kind: responseKind?.kind ?? '',
        namespaced: scope === 'Namespaced',
        verbs: verbs ?? [],
        subresources: (subresources ?? []).map(({ subresource }) => subresource),
      }))
    )
  );
}

export function hasStaleVersion(list: K8sAPIGroupDiscoveryList): boolean {
  return list.items.some(({ versions }) => (versions ?? []).some(({ freshness }) => freshness === 'Stale'));
}

export function isK8sAPIResourceList(value: unknown): value is K8sAPIResourceList {
  return (
    isObject(value) && 'resources' in value && Array.isArray(value.resources) && value.resources.every(isK8sAPIResource)
  );
}

export function isK8sAPIGroupDiscoveryList(value: unknown): value is K8sAPIGroupDiscoveryList {
  return isObject(value) && 'items' in value && Array.isArray(value.items) && value.items.every(isK8sAPIGroupDiscovery);
}

function isK8sAPIResource(value: unknown): value is K8sAPIResource {
  return (
    isObject(value) &&
    'name' in value &&
    typeof value.name === 'string' &&
    (!('kind' in value) || typeof value.kind === 'string') &&
    (!('namespaced' in value) || typeof value.namespaced === 'boolean') &&
    (!('verbs' in value) || isVerbs(value.verbs))
  );
}

function isK8sAPIGroupDiscovery(value: unknown): value is K8sAPIGroupDiscovery {
  return (
    isObject(value) &&
    'metadata' in value &&
    isObject(value.metadata) &&
    'name' in value.metadata &&
    typeof value.metadata.name === 'string' &&
    (!('versions' in value) || isNullableList(value.versions, isK8sAPIVersionDiscovery))
  );
}

function isK8sAPIVersionDiscovery(value: unknown): value is K8sAPIVersionDiscovery {
  return (
    isObject(value) &&
    'version' in value &&
    typeof value.version === 'string' &&
    (!('freshness' in value) || typeof value.freshness === 'string') &&
    (!('resources' in value) || isNullableList(value.resources, isK8sAPIResourceDiscovery))
  );
}

function isK8sAPIResourceDiscovery(value: unknown): value is K8sAPIResourceDiscovery {
  return (
    isObject(value) &&
    'resource' in value &&
    typeof value.resource === 'string' &&
    (!('scope' in value) || typeof value.scope === 'string') &&
    (!('responseKind' in value) || value.responseKind === null || isResponseKind(value.responseKind)) &&
    (!('verbs' in value) || isVerbs(value.verbs)) &&
    (!('subresources' in value) || isNullableList(value.subresources, isK8sAPISubresourceDiscovery))
  );
}

function isK8sAPISubresourceDiscovery(value: unknown): value is K8sAPISubresourceDiscovery {
  return (
    isObject(value) &&
    'subresource' in value &&
    typeof value.subresource === 'string' &&
    (!('verbs' in value) || isVerbs(value.verbs))
  );
}

function isResponseKind(value: unknown): boolean {
  return isObject(value) && (!('kind' in value) || typeof value.kind === 'string');
}

function isVerbs(value: unknown): boolean {
  return isNullableList(value, (verb) => typeof verb === 'string');
}

function isNullableList(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return value === null || (Array.isArray(value) && value.every(isItem));
}
