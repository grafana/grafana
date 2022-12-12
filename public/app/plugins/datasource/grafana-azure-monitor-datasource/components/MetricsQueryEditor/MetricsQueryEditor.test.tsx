import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import createMockDatasource from '../../__mocks__/datasource';
import { createMockInstanceSetttings } from '../../__mocks__/instanceSettings';
import createMockPanelData from '../../__mocks__/panelData';
import createMockQuery from '../../__mocks__/query';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockGetValidLocations,
  mockResourcesByResourceGroup,
} from '../../__mocks__/resourcePickerRows';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';

import MetricsQueryEditor from './MetricsQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

const variableOptionGroup = {
  label: 'Template variables',
  options: [],
};

export function createMockResourcePickerData() {
  const mockDatasource = createMockDatasource();
  const mockResourcePicker = new ResourcePickerData(
    createMockInstanceSetttings(),
    mockDatasource.azureMonitorDatasource
  );

  mockResourcePicker.getSubscriptions = jest.fn().mockResolvedValue(createMockSubscriptions());
  mockResourcePicker.getResourceGroupsBySubscriptionId = jest
    .fn()
    .mockResolvedValue(createMockResourceGroupsBySubscription());
  mockResourcePicker.getResourcesForResourceGroup = jest.fn().mockResolvedValue(mockResourcesByResourceGroup());
  mockResourcePicker.getResourceURIFromWorkspace = jest.fn().mockReturnValue('');
  mockResourcePicker.getResourceURIDisplayProperties = jest.fn().mockResolvedValue({});
  mockResourcePicker.getLogsLocations = jest.fn().mockResolvedValue(mockGetValidLocations());
  return mockResourcePicker;
}

describe('MetricsQueryEditor', () => {
  const originalScrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  const mockPanelData = createMockPanelData();

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  afterEach(() => {
    window.HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it('should render', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });

    render(
      <MetricsQueryEditor
        data={mockPanelData}
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={() => {}}
        setError={() => {}}
      />
    );

    expect(await screen.findByTestId('azure-monitor-metrics-query-editor-with-experimental-ui')).toBeInTheDocument();
  });

  it('should change resource when a resource is selected in the ResourcePicker', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resourceGroup;
    delete query?.azureMonitor?.resourceName;
    delete query?.azureMonitor?.metricNamespace;
    const onChange = jest.fn();

    render(
      <MetricsQueryEditor
        data={mockPanelData}
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
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toBeCalledTimes(1);
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        subscription: 'def-456',
        azureMonitor: expect.objectContaining({
          metricNamespace: 'microsoft.compute/virtualmachines',
          resourceGroup: 'dev-3',
          resourceName: 'web-server',
        }),
      })
    );
  });

  it('should change the metric name when selected', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
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
        data={mockPanelData}
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
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const onChange = jest.fn();
    const mockQuery = createMockQuery();

    render(
      <MetricsQueryEditor
        data={mockPanelData}
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
