import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from '@grafana/ui';

import MetricsQueryEditor from './MetricsQueryEditor';
import createMockQuery from '../../__mocks__/query';
import createMockDatasource from '../../__mocks__/datasource';
import createMockResourcePickerData from '../../__mocks__/resourcePickerData';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockResourcesByResourceGroup,
} from '../../__mocks__/resourcePickerRows';

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

const resourcePickerData = createMockResourcePickerData({
  getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
  getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
  getResourcesForResourceGroup: jest.fn().mockResolvedValue(mockResourcesByResourceGroup()),
});

describe('MetricsQueryEditor', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('should render', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData });

    render(
      <MetricsQueryEditor
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
        setError={() => {}}
      />
    );

    expect(await screen.findByTestId('azure-monitor-metrics-query-editor-with-resource-picker')).toBeInTheDocument();
  });

  it('should change resource when a resource is selected in the ResourcePicker', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData });
    const query = createMockQuery();
    delete query?.azureMonitor?.resourceUri;
    const onChange = jest.fn();

    render(
      <MetricsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: 'Select a resource' });
    expect(resourcePickerButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand Primary Subscription' })).not.toBeInTheDocument();
    resourcePickerButton.click();

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    expect(subscriptionButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand A Great Resource Group' })).not.toBeInTheDocument();
    subscriptionButton.click();

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    expect(resourceGroupButton).toBeInTheDocument();
    expect(screen.queryByLabelText('web-server')).not.toBeInTheDocument();
    resourceGroupButton.click();

    const checkbox = await screen.findByLabelText('web-server');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toBeCalledTimes(1);
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureMonitor: expect.objectContaining({
          resourceUri:
            '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/web-server',
        }),
      })
    );
  });

  it('should reset metric namespace, metric name, and aggregation fields after selecting a new resource when a valid query has already been set', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData });
    const query = createMockQuery();
    const onChange = jest.fn();

    render(
      <MetricsQueryEditor
        query={query}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const resourcePickerButton = await screen.findByRole('button', { name: /grafanastaging/ });

    expect(screen.getByText('Microsoft.Compute/virtualMachines')).toBeInTheDocument();
    expect(screen.getByText('Metric A')).toBeInTheDocument();
    expect(screen.getByText('Average')).toBeInTheDocument();

    expect(resourcePickerButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand Primary Subscription' })).not.toBeInTheDocument();
    resourcePickerButton.click();

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Dev Subscription' });
    expect(subscriptionButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand Development 3' })).not.toBeInTheDocument();
    subscriptionButton.click();

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand Development 3' });
    expect(resourceGroupButton).toBeInTheDocument();
    expect(screen.queryByLabelText('db-server')).not.toBeInTheDocument();
    resourceGroupButton.click();

    const checkbox = await screen.findByLabelText('db-server');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
    userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toBeCalledTimes(1);
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureMonitor: expect.objectContaining({
          resourceUri:
            '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server',
          metricNamespace: undefined,
          metricName: undefined,
          aggregation: undefined,
          timeGrain: '',
          dimensionFilters: [],
        }),
      })
    );
  });

  it('should change the metric name when selected', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData });
    const onChange = jest.fn();
    const mockQuery = createMockQuery();
    mockDatasource.azureMonitorDatasource.newGetMetricNames = jest.fn().mockResolvedValue([
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
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const metrics = await screen.findByLabelText('Metric');
    expect(metrics).toBeInTheDocument();
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
    const mockDatasource = createMockDatasource({ resourcePickerData });
    const onChange = jest.fn();
    const mockQuery = createMockQuery();

    render(
      <MetricsQueryEditor
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={onChange}
        setError={() => {}}
      />
    );

    const aggregation = await screen.findByLabelText('Aggregation');
    expect(aggregation).toBeInTheDocument();
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
