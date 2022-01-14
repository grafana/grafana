import { ResourcesWithUnits } from '../DBCluster.types';

export const getResourcesWidth = (allocated?: number, total?: number) => {
  if (!allocated || !total || total <= 0) {
    return 0;
  }

  return Math.round(((allocated * 100) / total) * 10) / 10;
};

export const formatResources = (resource: ResourcesWithUnits) => ({
  ...resource,
  value: Math.round(resource.value * 100 + Number.EPSILON) / 100,
});
