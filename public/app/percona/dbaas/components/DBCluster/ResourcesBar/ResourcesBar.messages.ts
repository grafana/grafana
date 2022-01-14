export const Messages = {
  buildResourcesLabel: (allocated: number, allocatedWidth: number, total: number, units: string) =>
    `${allocated} ${units} (${allocatedWidth}%) of ${total} ${units} used`,
  buildExpectedLabel: (expected: number, resourceLabel: string, units: string) =>
    `Required ${resourceLabel} (${expected} ${units})`,
  buildAllocatedLabel: (resourceLabel: string) => `Consumed ${resourceLabel}`,
  buildInsufficientLabel: (resourceLabel: string) => `Insufficient ${resourceLabel}`,
};
