export const Messages = {
    buildResourcesLabel: (allocated, allocatedWidth, total, emptyValueMessage) => isNaN(allocated.value) && emptyValueMessage
        ? emptyValueMessage
        : `Using ${allocated.value} ${allocated.units} (${allocatedWidth}%) of ${total.value} ${total.units} in total`,
    buildExpectedLabel: (expected, resourceLabel) => `Required ${resourceLabel} (${expected.value} ${expected.units})`,
    buildExpectedAllocatedLabel: (expectedDowsize, resourceLabel) => `Expected Consumed ${resourceLabel} (${expectedDowsize.value} ${expectedDowsize.units})`,
    buildAllocatedLabel: (resourceLabel) => `Consumed ${resourceLabel}`,
    buildInsufficientLabel: (expected, resourceLabel) => `Insufficient ${resourceLabel} (${expected.value} ${expected.units} required)`,
};
//# sourceMappingURL=ResourcesBar.messages.js.map