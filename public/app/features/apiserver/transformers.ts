import { Resource, ResourceList, GeneratedResource, GeneratedResourceList } from './types';

/**
 * Converts a GeneratedResource to a standard Resource
 */
export function toResource<T = object, S = object, K = string>(
  generated: GeneratedResource<T, S, K>
): Resource<T, S, K> {
  if (!generated.apiVersion || !generated.kind) {
    throw new Error('Cannot convert to Resource: missing apiVersion or kind');
  }

  if (!generated.metadata?.name || !generated.metadata?.resourceVersion) {
    throw new Error('Cannot convert to Resource: missing required metadata fields');
  }

  const kind: K = generated.kind;

  if (!generated.spec) {
    throw new Error('Cannot convert to Resource: missing spec field');
  }

  const resource: Resource<T, S, K> = {
    apiVersion: generated.apiVersion,
    kind,
    metadata: {
      name: generated.metadata.name,
      namespace: generated.metadata.namespace,
      resourceVersion: generated.metadata.resourceVersion,
      generation: generated.metadata.generation,
      creationTimestamp: generated.metadata.creationTimestamp || new Date().toISOString(),
      annotations: generated.metadata.annotations,
      labels: generated.metadata.labels,
    },
    spec: generated.spec,
  };

  if (generated.status) {
    resource.status = generated.status;
  }

  return resource;
}

/**
 * Converts a GeneratedResourceList to a standard ResourceList
 */
export function toResourceList<T = object, S = object, K = string>(
  generatedList: GeneratedResourceList<T, S, K>,
  apiVersion?: string,
  kind?: string
): ResourceList<T, S, K> {
  if (!generatedList.metadata?.resourceVersion) {
    throw new Error('Cannot convert to ResourceList: missing required metadata fields');
  }

  return {
    apiVersion: apiVersion || '',
    kind: kind || 'List',
    metadata: {
      resourceVersion: generatedList.metadata.resourceVersion,
      continue: generatedList.metadata.continue,
      remainingItemCount: generatedList.metadata.remainingItemCount,
    },
    items: (generatedList.items || []).map((item) => toResource<T, S, K>(item)),
  };
}
