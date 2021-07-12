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
        setError={() => {}}
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
        setError={() => {}}
      />
    );

    const subscriptions = await screen.findByLabelText('Subscription');
    await selectEvent.select(subscriptions, 'Another Subscription', { container: document.body });

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
        aggregation: undefined,
        timeGrain: '',
        dimensionFilters: [],
      },
    });
  });

  it('should change the metric name when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.getMetricNames = jest.fn().mockResolvedValue([
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
        setError={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Metric');
    await selectEvent.select(metrics, 'Metric B', { container: document.body });

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        metricName: 'metric-b',
      },
    });
  });

  it('should auto select a default aggregation if none exists once a metric is selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockQuery.azureMonitor.aggregation = undefined;
    mockDatasource.getMetricNames = jest.fn().mockResolvedValue([
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
        setError={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const metrics = await screen.findByLabelText('Metric');
    await selectEvent.select(metrics, 'Metric B', { container: document.body });

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        metricName: 'metric-b',
        aggregation: 'Average',
      },
    });
  });

  it('should change the aggregation type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    render(
      <MetricsQueryEditor
        subscriptionId="123"
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    const aggregation = await screen.findByLabelText('Aggregation');
    await selectEvent.select(aggregation, 'Maximum', { container: document.body });

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        aggregation: 'Maximum',
      },
    });
  });
});
