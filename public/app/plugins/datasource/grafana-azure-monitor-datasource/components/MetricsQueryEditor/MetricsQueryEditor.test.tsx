import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { selectOptionInTest } from '@grafana/ui';

import createMockDatasource from '../../__mocks__/datasource';
import createMockQuery from '../../__mocks__/query';

import MetricsQueryEditor from './MetricsQueryEditor';

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

  it('should change the resource group when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.getResourceGroups = jest.fn().mockResolvedValue([
      { text: 'grafanastaging', value: 'grafanastaging' },
      { text: 'Grafana Prod', value: 'grafanaprod' },
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

    const resourceGroup = await screen.findByLabelText('Resource group');
    await selectOptionInTest(resourceGroup, 'Grafana Prod');

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        resourceUri: '',
        resourceGroup: 'grafanaprod',
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

  it('should change the resource type when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.getMetricDefinitions = jest.fn().mockResolvedValue([
      { text: 'Virtual Machine', value: 'azure/vm' },
      { text: 'Database', value: 'azure/db' },
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

    const resourceGroup = await screen.findByLabelText('Resource type');
    await selectOptionInTest(resourceGroup, 'Virtual Machine');

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        resourceUri: '',
        metricDefinition: 'azure/vm',
        resourceName: undefined,
        metricNamespace: undefined,
        metricName: undefined,
        aggregation: undefined,
        timeGrain: '',
        dimensionFilters: [],
      },
    });
  });

  it('should change the resource name when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.getResourceNames = jest.fn().mockResolvedValue([
      { text: 'ResourceName1', value: 'resource-name-1' },
      { text: 'ResourceName2', value: 'resource-name-2' },
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

    const resourceGroup = await screen.findByLabelText('Resource name');
    await selectOptionInTest(resourceGroup, 'ResourceName1');

    expect(onChange).toHaveBeenLastCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        resourceUri: '',
        resourceName: 'resource-name-1',
        metricNamespace: undefined,
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
    mockDatasource.azureMonitorDatasource.getMetricNames = jest.fn().mockResolvedValue([
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
