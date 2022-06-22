import createMockQuery from '../../__mocks__/query';

import { setResource } from './setQueryValue';

describe('setResource', () => {
  it('should set a resource URI', () => {
    const q = setResource(createMockQuery(), '/new-uri');
    expect(q.azureMonitor?.resourceUri).toEqual('/new-uri');
  });

  it('should remove clean up dependent fields', () => {
    const q = createMockQuery();
    expect(q.azureMonitor?.metricNamespace).not.toEqual(undefined);
    expect(q.azureMonitor?.metricName).not.toEqual(undefined);
    expect(q.azureMonitor?.metricDefinition).not.toEqual(undefined);
    expect(q.azureMonitor?.aggregation).not.toEqual(undefined);
    expect(q.azureMonitor?.metricDefinition).not.toEqual(undefined);
    expect(q.azureMonitor?.metricDefinition).not.toEqual(undefined);
    expect(q.azureMonitor?.timeGrain).not.toEqual('');
    expect(q.azureMonitor?.timeGrain).not.toEqual([]);
    const newQ = setResource(createMockQuery(), '/new-uri');
    expect(newQ.azureMonitor).toMatchObject({
      metricNamespace: undefined,
      metricName: undefined,
      aggregation: undefined,
      metricDefinition: undefined,
      timeGrain: '',
      dimensionFilters: [],
    });
  });
});
