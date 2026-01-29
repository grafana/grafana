import { isObject } from '@grafana/data';

import { K8sStatusCause, Resource, ResourceList } from './types';

/**
 * Type guard to check if an unknown value has all required fields to be a Resource
 */
export function isResource<T = object, S = object, K = string>(value: unknown): value is Resource<T, S, K> {
  if (!isObject(value) || !('metadata' in value) || !('spec' in value)) {
    return false;
  }

  const { metadata, spec } = value;
  if (!isObject(metadata) || !isObject(spec)) {
    return false;
  }

  return (
    'name' in metadata &&
    typeof metadata.name === 'string' &&
    'resourceVersion' in metadata &&
    typeof metadata.resourceVersion === 'string' &&
    'creationTimestamp' in metadata &&
    typeof metadata.creationTimestamp === 'string'
  );
}

/**
 * Type guard to check if an unknown value has all required fields to be a ResourceList
 */
export function isResourceList<T = object, S = object, K = string>(value: unknown): value is ResourceList<T, S, K> {
  if (!isObject(value) || !('metadata' in value) || !('items' in value)) {
    return false;
  }

  const { metadata, items } = value;
  if (!isObject(metadata)) {
    return false;
  }

  return 'resourceVersion' in metadata && typeof metadata.resourceVersion === 'string' && Array.isArray(items);
}

/**
 * Type guard to check if an item looks like a K8sStatusCause.
 */
export function isStatusCause(item: unknown): item is K8sStatusCause {
  return isObject(item) && 'field' in item && 'message' in item && 'reason' in item;
}

/**
 * Type guard to check if data is a Kubernetes Status failure response.
 */
export function isStatusFailure(
  data: unknown
): data is { kind: string; status: string; details?: { causes?: K8sStatusCause[] } } {
  if (isObject(data) && 'kind' in data && 'status' in data && data.kind === 'Status' && data.status === 'Failure') {
    if ('details' in data && isObject(data.details)) {
      if ('causes' in data.details) {
        const causes = data.details.causes;
        return Array.isArray(causes) && causes.every(isStatusCause);
      }
    }
    return true;
  }
  return false;
}
