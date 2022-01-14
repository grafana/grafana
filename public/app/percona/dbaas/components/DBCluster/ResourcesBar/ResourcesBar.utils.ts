import { ResourcesUnits, ResourcesWithUnits } from '../DBCluster.types';
import { getResourcesSum } from '../DBCluster.utils';

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

export const getExpectedAllocatedWidth = (expected?: ResourcesWithUnits, allocated?: ResourcesWithUnits) => {
  if (!expected || !allocated || Math.abs(expected.original) > allocated.original) {
    return 0;
  }

  return 100 - Math.abs(getResourcesWidth(expected.original, allocated.original));
};

export const getExpectedAllocated = (
  expected?: ResourcesWithUnits,
  allocated?: ResourcesWithUnits
): ResourcesWithUnits => {
  if (!expected || !allocated || Math.abs(expected.original) > allocated.original) {
    return { value: 0, original: 0, units: expected?.units || ResourcesUnits.BYTES };
  }

  return getResourcesSum(expected, allocated) as ResourcesWithUnits;
};
