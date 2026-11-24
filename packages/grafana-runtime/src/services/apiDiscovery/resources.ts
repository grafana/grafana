import { isObject } from '@grafana/data';

import { type K8sAPIGroupDiscoveryList, type K8sAPIResourceList, type APIResourceInfo } from './types';

/** The resources of one group version, plus the verbs of each `<resource>/<subresource>`. */
export interface GroupVersionResources {
  resources: readonly APIResourceInfo[];
  subresourceVerbs: ReadonlyMap<string, readonly string[]>;
}

export function fromK8sAPIResourceList(
  group: string,
  version: string,
  list: K8sAPIResourceList
): GroupVersionResources {
  const entries = list.resources ?? [];
  const subresources = entries.filter(({ name }) => name.includes('/'));
  const resources = entries
    .filter(({ name }) => !name.includes('/'))
    .map(({ name, kind, namespaced, verbs }) => ({
      group,
      version,
      resource: name,
      kind,
      namespaced,
      verbs: verbs ?? [],
      subresources: subresources
        .filter((sub) => sub.name.startsWith(`${name}/`))
        .map((sub) => sub.name.slice(name.length + 1)),
    }));
  return { resources, subresourceVerbs: new Map(subresources.map(({ name, verbs }) => [name, verbs ?? []])) };
}

export function fromK8sAPIGroupDiscoveryList(list: K8sAPIGroupDiscoveryList): APIResourceInfo[] {
  return (list.items ?? []).flatMap(({ metadata, versions = [] }) =>
    versions.flatMap(({ version, resources = [] }) =>
      resources.map((entry) => ({
        group: metadata.name,
        version,
        resource: entry.resource,
        kind: entry.responseKind?.kind ?? '',
        namespaced: entry.scope === 'Namespaced',
        verbs: entry.verbs ?? [],
        subresources: (entry.subresources ?? []).map(({ subresource }) => subresource),
      }))
    )
  );
}

export function hasStaleVersion(list: K8sAPIGroupDiscoveryList): boolean {
  return (list.items ?? []).some(({ versions = [] }) => versions.some(({ freshness }) => freshness === 'Stale'));
}

export function isK8sAPIResourceList(value: unknown): value is K8sAPIResourceList {
  return isObject(value) && 'resources' in value && isNullableList(value.resources, isK8sAPIResource);
}

export function isK8sAPIGroupDiscoveryList(value: unknown): value is K8sAPIGroupDiscoveryList {
  return isObject(value) && 'items' in value && isNullableList(value.items, isK8sAPIGroupDiscovery);
}

function isK8sAPIResource(value: unknown): boolean {
  return (
    isObject(value) &&
    'name' in value &&
    typeof value.name === 'string' &&
    'kind' in value &&
    typeof value.kind === 'string' &&
    'namespaced' in value &&
    typeof value.namespaced === 'boolean' &&
    'verbs' in value &&
    isNullableList(value.verbs, isString)
  );
}

function isK8sAPIGroupDiscovery(value: unknown): boolean {
  return (
    isObject(value) &&
    'metadata' in value &&
    isObject(value.metadata) &&
    'name' in value.metadata &&
    typeof value.metadata.name === 'string' &&
    (!('versions' in value) || isList(value.versions, isK8sAPIVersionDiscovery))
  );
}

function isK8sAPIVersionDiscovery(value: unknown): boolean {
  return (
    isObject(value) &&
    'version' in value &&
    typeof value.version === 'string' &&
    (!('freshness' in value) || typeof value.freshness === 'string') &&
    (!('resources' in value) || isList(value.resources, isK8sAPIResourceDiscovery))
  );
}

function isK8sAPIResourceDiscovery(value: unknown): boolean {
  return (
    isObject(value) &&
    'resource' in value &&
    typeof value.resource === 'string' &&
    'scope' in value &&
    typeof value.scope === 'string' &&
    'verbs' in value &&
    isNullableList(value.verbs, isString) &&
    (!('responseKind' in value) || isResponseKind(value.responseKind)) &&
    (!('subresources' in value) || isList(value.subresources, isK8sAPISubresourceDiscovery))
  );
}

function isK8sAPISubresourceDiscovery(value: unknown): boolean {
  return (
    isObject(value) &&
    'subresource' in value &&
    typeof value.subresource === 'string' &&
    'verbs' in value &&
    isNullableList(value.verbs, isString)
  );
}

function isResponseKind(value: unknown): boolean {
  return isObject(value) && (!('kind' in value) || typeof value.kind === 'string');
}

function isNullableList(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return value === null || isList(value, isItem);
}

function isList(value: unknown, isItem: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(isItem);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
