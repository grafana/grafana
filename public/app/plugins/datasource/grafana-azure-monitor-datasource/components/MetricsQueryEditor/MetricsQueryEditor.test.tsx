import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { selectOptionInTest } from '@grafana/ui';

import createMockDatasource from '../../__mocks__/datasource';
import createMockPanelData from '../../__mocks__/panelData';
import createMockQuery from '../../__mocks__/query';

import MetricsQueryEditor from './MetricsQueryEditor';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

describe('Azure Monitor QueryEditor', () => {
  const mockPanelData = createMockPanelData();
  it('should render', async () => {
    const mockDatasource = createMockDatasource();
    render(
      <MetricsQueryEditor
        data={mockPanelData}
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
    (mockQuery.azureMonitor ?? {}).metricName = undefined;
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
        data={mockPanelData}
        subscriptionId="123"
        query={mockQuery}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const subscriptions = await screen.findByLabelText('Subscription');
    await selectOptionInTest(subscriptions, 'Another Subscription');

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
        data={mockPanelData}
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
    await selectOptionInTest(metrics, 'Metric B');

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        metricName: 'metric-b',
        aggregation: undefined,
        timeGrain: '',
      },
    });
  });

  it('should change the aggregation type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    render(
      <MetricsQueryEditor
        data={mockPanelData}
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
    await selectOptionInTest(aggregation, 'Maximum');

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        aggregation: 'Maximum',
      },
    });
  });
});
