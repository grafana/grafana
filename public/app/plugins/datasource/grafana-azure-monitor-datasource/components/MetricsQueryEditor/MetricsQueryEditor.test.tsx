import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import selectEvent from 'react-select-event';

import MetricsQueryEditor from './MetricsQueryEditor';

import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('Azure Monitor QueryEditor', () => {
  it('should render', async () => {
    const mockDatasource = createMockDatasource();
    render(
      <MetricsQueryEditor
        subscriptionId="123"
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it('should change the subscription ID when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockQuery.azureMonitor.metricName = undefined;
    mockDatasource.azureMonitorDatasource.getSubscriptions = jest.fn().mockResolvedValueOnce([
      {
        value: 'abc-123',
        text: 'Primary Subscription',
      },
      {
        value: 'abc-456',
        text: 'Another Subscription',
      },
    ]);

    render(
      <MetricsQueryEditor
        subscriptionId="123"
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
      />
    );

    const subscriptions = await screen.findByLabelText('Subscription');
    await selectEvent.select(subscriptions, 'Another Subscription');

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      subscription: 'abc-456',
      azureMonitor: {
        ...mockQuery.azureMonitor,
        resourceGroup: undefined,
        metricDefinition: undefined,
        metricNamespace: undefined,
        resourceName: undefined,
        metricName: undefined,
        aggregation: '',
        timeGrain: '',
        dimensionFilters: [],
      },
    });
  });

  it('should change the metric name when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.getMetricNames = jest.fn().mockResolvedValueOnce([
      {
        value: 'metric-a',
        text: 'Metric A',
      },
      {
        value: 'metric-b',
        text: 'Metric B',
      },
    ]);
    render(
      <MetricsQueryEditor
        subscriptionId="123"
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Metric');
    await selectEvent.select(metrics, 'Metric B');

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        metricName: 'metric-b',
      },
    });
  });
});
