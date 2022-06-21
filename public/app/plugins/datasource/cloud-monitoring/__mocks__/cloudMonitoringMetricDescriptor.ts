import { MetricDescriptor, MetricKind, ValueTypes } from '../types';

export const createMockMetricDescriptor = (overrides?: Partial<MetricDescriptor>): MetricDescriptor => {
  return {
    metricKind: MetricKind.CUMULATIVE,
    valueType: ValueTypes.DOUBLE,
    type: 'type',
    unit: 'unit',
    service: 'service',
    serviceShortName: 'srv',
    displayName: 'displayName',
    description: 'description',
    ...overrides,
  };
};
