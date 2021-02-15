import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import MetricsQueryEditor from '../MetricsQueryEditor';

import mockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';

describe('Azure Monitor QueryEditor', () => {
  it('should render', async () => {
    const mockDatasource = createMockDatasource();
    render(
      <MetricsQueryEditor subscriptionId="123" query={mockQuery} datasource={mockDatasource} onChange={() => {}} />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());
  });

  it('should change the subscription ID when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
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
      <MetricsQueryEditor subscriptionId="123" query={mockQuery} datasource={mockDatasource} onChange={onChange} />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    // Click the dropdown, then select an option
    userEvent.click(screen.getByText('Primary Subscription'));
    userEvent.click(screen.getByText('Another Subscription'));

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      subscription: 'abc-456',
      azureMonitor: {
        ...mockQuery.azureMonitor,
        resourceGroup: 'select',
        metricDefinition: 'select',
        resourceName: 'select',
        metricName: 'select',
        aggregation: '',
        timeGrain: '',
        dimensionFilters: [],
      },
    });
  });

  it('should change the metric name when selected', async () => {
    const mockDatasource = createMockDatasource();
    const onChange = jest.fn();
    mockDatasource.azureMonitorDatasource.getMetricNames = jest.fn().mockResolvedValueOnce([
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
      <MetricsQueryEditor subscriptionId="123" query={mockQuery} datasource={mockDatasource} onChange={onChange} />
    );
    await waitFor(() => expect(screen.getByTestId('azure-monitor-metrics-query-editor')).toBeInTheDocument());

    // Click the dropdown, then select an option
    userEvent.click(screen.getByText('Metric A'));
    userEvent.click(screen.getByText('Metric B'));

    expect(onChange).toHaveBeenCalledWith({
      ...mockQuery,
      azureMonitor: {
        ...mockQuery.azureMonitor,
        metricName: 'metric-b',
      },
    });
  });
});
