import { Resource, ResourceList, GeneratedResource, GeneratedResourceList } from './types';

/**
 * Type guard to check if a GeneratedResource has all required fields to be a Resource
 */
export function isResource<T = object, S = object, K = string>(
  generated: GeneratedResource<T, S, K>
): generated is Resource<T, S, K> {
  return (
    !!generated.apiVersion &&
    !!generated.kind &&
    !!generated.metadata?.name &&
    !!generated.metadata?.resourceVersion &&
    !!generated.metadata?.creationTimestamp &&
    !!generated.spec
  );
}

/**
 * Type guard to check if a GeneratedResourceList has all required fields to be a ResourceList
 */
export function isResourceList<T = object, S = object, K = string>(
  generatedList: GeneratedResourceList<T, S, K>
): generatedList is ResourceList<T, S, K> {
  return !!generatedList.metadata?.resourceVersion && Array.isArray(generatedList.items);
}
