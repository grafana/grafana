import { Resource, ResourceList } from './types';

/**
 * Helper function to safely check if a value is a non-null object
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

/**
 * Type guard to check if an unknown value has all required fields to be a Resource
 */
export function isResource<T = object, S = object, K = string>(value: unknown): value is Resource<T, S, K> {
  if (!isObject(value)) {
    return false;
  }

  const metadata = value.metadata;
  if (!isObject(metadata)) {
    return false;
  }

  return (
    typeof value.apiVersion === 'string' &&
    typeof value.kind === 'string' &&
    typeof metadata.name === 'string' &&
    typeof metadata.resourceVersion === 'string' &&
    typeof metadata.creationTimestamp === 'string' &&
    isObject(value.spec)
  );
}

/**
 * Type guard to check if an unknown value has all required fields to be a ResourceList
 */
export function isResourceList<T = object, S = object, K = string>(value: unknown): value is ResourceList<T, S, K> {
  if (!isObject(value)) {
    return false;
  }

  const metadata = value.metadata;
  if (!isObject(metadata)) {
    return false;
  }

  return typeof metadata.resourceVersion === 'string' && Array.isArray(value.items);
}
