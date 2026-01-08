import { IconName } from '@grafana/ui';

import { ResourceDependencyDto } from '../api';

import { ResourceTableItem } from './types';

export type ResourceTypeId = ResourceTableItem['type'];

export interface ResourceType {
  id: ResourceTypeId;
  name: string;
  icon: IconName;
}

export function buildDependencyMaps(resourceDependencies: ResourceDependencyDto[]) {
  const dependencyMap = new Map<ResourceTypeId, ResourceTypeId[]>();
  const dependentMap = new Map<ResourceTypeId, ResourceTypeId[]>();

  for (const dependency of resourceDependencies) {
    const resourceType = dependency.resourceType as ResourceTypeId;
    const dependencies = (dependency.dependencies || []) as ResourceTypeId[];

    dependencyMap.set(resourceType, dependencies);

    // Build reverse mapping (what depends on what)
    for (const dep of dependencies) {
      if (!dependentMap.has(dep)) {
        dependentMap.set(dep, []);
      }

      dependentMap.get(dep)?.push(resourceType);
    }
  }

  return { dependencyMap, dependentMap };
}

export function handleSelection(
  dependencyMap: Map<ResourceTypeId, ResourceTypeId[]>,
  selectedTypes: Set<ResourceTypeId>,
  resourceToSelect: ResourceTypeId
): Set<ResourceTypeId> {
  const result = new Set(selectedTypes);

  function selectWithDependencies(resourceType: ResourceTypeId, visited: Set<ResourceTypeId>) {
    if (visited.has(resourceType)) {
      return;
    }

    visited.add(resourceType);
    result.add(resourceType);

    dependencyMap.get(resourceType)?.forEach((dep) => selectWithDependencies(dep, visited));
  }

  selectWithDependencies(resourceToSelect, new Set());

  return result;
}

export function handleDeselection(
  dependentMap: Map<ResourceTypeId, ResourceTypeId[]>,
  selectedTypes: Set<ResourceTypeId>,
  resourceToDeselect: ResourceTypeId
): Set<ResourceTypeId> {
  const result = new Set(selectedTypes);

  function processDeselection(resourceType: ResourceTypeId, visited: Set<ResourceTypeId>) {
    if (visited.has(resourceType)) {
      return;
    }

    visited.add(resourceType);
    result.delete(resourceType);

    dependentMap.get(resourceType)?.forEach((dep) => processDeselection(dep, visited));
  }

  processDeselection(resourceToDeselect, new Set());

  return result;
}
