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
  const subresources = list.resources.filter(({ name }) => name.includes('/'));
  const resources = list.resources
    .filter(({ name }) => !name.includes('/'))
    .map(({ name, kind, namespaced, verbs }) => ({
      group,
      version,
      resource: name,
      kind,
      namespaced,
      verbs,
      subresources: subresources
        .filter((sub) => sub.name.startsWith(`${name}/`))
        .map((sub) => sub.name.slice(name.length + 1)),
    }));
  return { resources, subresourceVerbs: new Map(subresources.map(({ name, verbs }) => [name, verbs])) };
}

export function fromK8sAPIGroupDiscoveryList(list: K8sAPIGroupDiscoveryList): APIResourceInfo[] {
  return list.items.flatMap(({ metadata, versions }) =>
    versions.flatMap(({ version, resources }) =>
      resources.map((entry) => ({
        group: metadata.name,
        version,
        resource: entry.resource,
        kind: entry.responseKind?.kind ?? '',
        namespaced: entry.scope === 'Namespaced',
        verbs: entry.verbs,
        subresources: (entry.subresources ?? []).map(({ subresource }) => subresource),
      }))
    )
  );
}

export function isK8sAPIResourceList(value: unknown): value is K8sAPIResourceList {
  return (
    isObject(value) &&
    'resources' in value &&
    Array.isArray(value.resources) &&
    value.resources.every(
      (entry) =>
        isObject(entry) &&
        'name' in entry &&
        typeof entry.name === 'string' &&
        'kind' in entry &&
        typeof entry.kind === 'string' &&
        'namespaced' in entry &&
        typeof entry.namespaced === 'boolean' &&
        'verbs' in entry &&
        isStringArray(entry.verbs)
    )
  );
}

export function isK8sAPIGroupDiscoveryList(value: unknown): value is K8sAPIGroupDiscoveryList {
  return (
    isObject(value) &&
    'items' in value &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isObject(item) &&
        'metadata' in item &&
        isObject(item.metadata) &&
        'name' in item.metadata &&
        typeof item.metadata.name === 'string' &&
        'versions' in item &&
        Array.isArray(item.versions) &&
        item.versions.every(
          (version) =>
            isObject(version) &&
            'version' in version &&
            typeof version.version === 'string' &&
            'resources' in version &&
            Array.isArray(version.resources) &&
            version.resources.every(isK8sAPIResourceDiscovery)
        )
    )
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
    isStringArray(value.verbs) &&
    (!('responseKind' in value) || isResponseKind(value.responseKind)) &&
    (!('subresources' in value) ||
      (Array.isArray(value.subresources) && value.subresources.every(isK8sAPISubresourceDiscovery)))
  );
}

function isK8sAPISubresourceDiscovery(value: unknown): boolean {
  return (
    isObject(value) &&
    'subresource' in value &&
    typeof value.subresource === 'string' &&
    'verbs' in value &&
    isStringArray(value.verbs)
  );
}

function isResponseKind(value: unknown): boolean {
  return isObject(value) && (!('kind' in value) || typeof value.kind === 'string');
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
