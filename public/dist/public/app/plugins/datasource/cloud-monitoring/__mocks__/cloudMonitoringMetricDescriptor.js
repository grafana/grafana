import { MetricKind, ValueTypes } from '../types/query';
export const createMockMetricDescriptor = (overrides) => {
    return Object.assign({ metricKind: MetricKind.CUMULATIVE, valueType: ValueTypes.DOUBLE, type: 'type', unit: 'unit', service: 'service', serviceShortName: 'srv', displayName: 'metricName', description: 'description' }, overrides);
};
//# sourceMappingURL=cloudMonitoringMetricDescriptor.js.map