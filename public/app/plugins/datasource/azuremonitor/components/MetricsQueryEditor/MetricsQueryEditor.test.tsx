import { render, screen, waitFor } from '@testing-library/react';
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
  ...jest.requireActual('@grafana/runtime'),
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
  mockResourcePicker.getLocations = jest.fn().mockResolvedValue(mockGetValidLocations());
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

  it('should show the current resource in the ResourcePicker', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery({
      subscription: 'def-456',
      azureMonitor: {
        metricNamespace: 'Microsoft.Compute/virtualMachines',
        resources: [
          {
            resourceGroup: 'dev-3',
            resourceName: 'web-server',
          },
        ],
      },
    });
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

    const resourcePickerButton = await screen.findByRole('button', { name: 'web-server' });
    expect(resourcePickerButton).toBeInTheDocument();
    await userEvent.click(resourcePickerButton);

    await waitFor(async () => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      const selection = await screen.findAllByLabelText('web-server');
      expect(selection).toHaveLength(2);
    });
  });

  it('should change resource when a resource is selected in the ResourcePicker', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    expect(subscriptionButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand A Great Resource Group' })).not.toBeInTheDocument();
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    expect(resourceGroupButton).toBeInTheDocument();
    expect(screen.queryByLabelText('web-server')).not.toBeInTheDocument();
    await userEvent.click(resourceGroupButton);

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
          resources: [
            expect.objectContaining({
              resourceGroup: 'dev-3',
              resourceName: 'web-server',
            }),
          ],
        }),
      })
    );
  });

  it('should select multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const checkbox2 = await screen.findByLabelText('db-server');
    await userEvent.click(checkbox2);
    expect(checkbox2).toBeChecked();

    await userEvent.click(await screen.findByRole('button', { name: 'Apply' }));

    expect(onChange).toBeCalledTimes(1);
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        subscription: 'def-456',
        azureMonitor: expect.objectContaining({
          metricNamespace: 'microsoft.compute/virtualmachines',
          resources: [
            expect.objectContaining({
              resourceGroup: 'dev-3',
              resourceName: 'web-server',
            }),
            expect.objectContaining({
              resourceGroup: 'dev-3',
              resourceName: 'db-server',
            }),
          ],
        }),
      })
    );
  });

  it('should disable other resource types when selecting multiple resources', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(await screen.findByLabelText('web-server_DataDisk')).toBeDisabled();
  });

  it('should show info about multiple selection', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    expect(
      await screen.findByText(
        'You can select items of the same resource type and location. To select resources of a different resource type or location, please first uncheck your current selection.'
      )
    ).toBeInTheDocument();
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

  it('should show unselect a resource if the value is manually edited', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);

    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const advancedSection = screen.getByText('Advanced');
    await userEvent.click(advancedSection);

    const advancedInput = await screen.findByLabelText('Subscription');
    await userEvent.type(advancedInput, 'def-123');

    const updatedCheckboxes = await screen.findAllByLabelText('web-server');
    expect(updatedCheckboxes.length).toBe(2);
    // Unselect the one listed in the rows
    expect(updatedCheckboxes[0]).not.toBeChecked();
    // But the one in the advanced section should still be selected
    expect(updatedCheckboxes[1]).toBeChecked();
  });

  it('should call onApply with a new subscription when a user types it in the selection box', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    const query = createMockQuery();
    delete query?.subscription;
    delete query?.azureMonitor?.resources;
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
    await userEvent.click(resourcePickerButton);

    const advancedSection = screen.getByText('Advanced');
    await userEvent.click(advancedSection);

    const advancedInput = await screen.findByLabelText('Subscription');
    await userEvent.type(advancedInput, 'def-123');
    const nsInput = await screen.findByLabelText('Namespace');
    await userEvent.type(nsInput, 'ns');
    const rgInput = await screen.findByLabelText('Resource Group');
    await userEvent.type(rgInput, 'rg');
    const rnInput = await screen.findByLabelText('Resource Name');
    await userEvent.type(rnInput, 'rn');

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);

    expect(onChange).toBeCalledTimes(1);
    expect(onChange).toBeCalledWith(
      expect.objectContaining({
        azureMonitor: expect.objectContaining({
          resources: [{ subscription: 'def-123', metricNamespace: 'ns', resourceGroup: 'rg', resourceName: 'rn' }],
        }),
      })
    );
  });
});
