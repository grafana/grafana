import { ResourcesWithUnits } from '../DBCluster.types';

export const Messages = {
  buildResourcesLabel: (allocated: ResourcesWithUnits, allocatedWidth: number, total: ResourcesWithUnits) =>
    `Using ${allocated.value} ${allocated.units} (${allocatedWidth}%) of ${total.value} ${total.units} in total`,
  buildExpectedLabel: (expected: ResourcesWithUnits, resourceLabel: string) =>
    `Required ${resourceLabel} (${expected.value} ${expected.units})`,
  buildAllocatedLabel: (resourceLabel: string) => `Consumed ${resourceLabel}`,
  buildInsufficientLabel: (expected: ResourcesWithUnits, resourceLabel: string) =>
    `Insufficient ${resourceLabel} (${expected.value} ${expected.units} required)`,
};
