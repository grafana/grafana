import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { openMenu } from 'react-select-event';

import { selectors } from '../../e2e/selectors';
import createMockDatasource from '../../mocks/datasource';
import createMockPanelData from '../../mocks/panelData';
import createMockQuery from '../../mocks/query';
import { selectOptionInTest } from '../../utils/testUtils';
import { createMockResourcePickerData } from '../LogsQueryEditor/mocks';
import { type ResourceRow, type ResourceRowGroup, ResourceRowType } from '../ResourcePicker/types';

import MetricsQueryEditor, {
  getSelectionNotice,
  isBatchableNamespace,
  isResourceRowDisabled,
} from './MetricsQueryEditor';

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

    expect(
      await screen.findByTestId(selectors.components.queryEditor.metricsQueryEditor.container.input)
    ).toBeInTheDocument();
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
    expect(onChange).toHaveBeenCalledWith(
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
    expect(onChange).toHaveBeenCalledWith(
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

  it('hides non-batchable namespaces from the namespace picker when the batch API is enabled', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    mockDatasource.azureMonitorDatasource.batchAPIEnabled = true;
    mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest.fn().mockResolvedValue([
      { text: 'Microsoft.Compute/virtualMachines', value: 'microsoft.compute/virtualmachines' },
      { text: 'Guest (classic)', value: 'azure.vm.windows.guestmetrics' },
      { text: 'Windows Azure Diagnostics', value: 'Windows Azure Diagnostics' },
      { text: 'My Custom Metrics', value: 'wad' },
    ]);

    render(
      <MetricsQueryEditor
        data={mockPanelData}
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={jest.fn()}
        setError={() => {}}
      />
    );

    const namespaceField = await screen.findByLabelText('Metric namespace');
    openMenu(namespaceField);

    const listbox = await screen.findByRole('listbox');
    await waitFor(() => expect(within(listbox).getByText('Microsoft.Compute/virtualMachines')).toBeInTheDocument());
    expect(within(listbox).queryByText('Guest (classic)')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('Windows Azure Diagnostics')).not.toBeInTheDocument();
    expect(within(listbox).queryByText('My Custom Metrics')).not.toBeInTheDocument();
  });

  it('shows all namespaces in the namespace picker when the batch API is disabled', async () => {
    const mockDatasource = createMockDatasource({ resourcePickerData: createMockResourcePickerData() });
    mockDatasource.azureMonitorDatasource.batchAPIEnabled = false;
    mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest.fn().mockResolvedValue([
      { text: 'Microsoft.Compute/virtualMachines', value: 'microsoft.compute/virtualmachines' },
      { text: 'Guest (classic)', value: 'azure.vm.windows.guestmetrics' },
    ]);

    render(
      <MetricsQueryEditor
        data={mockPanelData}
        query={createMockQuery()}
        datasource={mockDatasource}
        variableOptionGroup={variableOptionGroup}
        onChange={jest.fn()}
        setError={() => {}}
      />
    );

    const namespaceField = await screen.findByLabelText('Metric namespace');
    openMenu(namespaceField);

    const listbox = await screen.findByRole('listbox');
    await waitFor(() => expect(within(listbox).getByText('Guest (classic)')).toBeInTheDocument());
    expect(within(listbox).getByText('Microsoft.Compute/virtualMachines')).toBeInTheDocument();
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
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        azureMonitor: expect.objectContaining({
          resources: [{ subscription: 'def-123', metricNamespace: 'ns', resourceGroup: 'rg', resourceName: 'rn' }],
        }),
      })
    );
  });
});

const makeRow = (subscription: string, region: string, namespace: string, name: string): ResourceRow => ({
  id: name,
  uri: `/subscriptions/${subscription}/resourceGroups/rg/providers/${namespace}/${name}`,
  name,
  type: ResourceRowType.Resource,
  typeLabel: namespace,
  location: region,
});

const vmEastA = makeRow('sub-a', 'eastus', 'Microsoft.Compute/virtualMachines', 'vm-a');
const vmWestB = makeRow('sub-b', 'westus', 'Microsoft.Compute/virtualMachines', 'vm-b');
const storageEastA = makeRow('sub-a', 'eastus', 'Microsoft.Storage/storageAccounts', 'sa-a');

describe('isResourceRowDisabled', () => {
  it('never disables a row when nothing is selected', () => {
    expect(isResourceRowDisabled(vmWestB, [], true)).toBe(false);
    expect(isResourceRowDisabled(vmWestB, [], false)).toBe(false);
  });

  describe('batch API enabled', () => {
    it('allows the same namespace across subscriptions and regions', () => {
      expect(isResourceRowDisabled(vmWestB, [vmEastA], true)).toBe(false);
    });

    it('disables a different namespace', () => {
      expect(isResourceRowDisabled(storageEastA, [vmEastA], true)).toBe(true);
    });

    it('never disables subscription or resource group rows, as they may contain selectable resources', () => {
      const subscriptionRow: ResourceRow = {
        id: 'sub-b',
        uri: '/subscriptions/sub-b',
        name: 'sub-b',
        type: ResourceRowType.Subscription,
        typeLabel: 'Subscription',
      };
      const resourceGroupRow: ResourceRow = {
        id: 'rg',
        uri: '/subscriptions/sub-b/resourceGroups/rg',
        name: 'rg',
        type: ResourceRowType.ResourceGroup,
        typeLabel: 'Resource group',
      };
      // A VM is selected; these containers have a different (or absent) namespace but must stay enabled.
      expect(isResourceRowDisabled(subscriptionRow, [vmEastA], true)).toBe(false);
      expect(isResourceRowDisabled(resourceGroupRow, [vmEastA], true)).toBe(false);
    });

    it('disables Guest OS metric namespaces, even as the first selection', () => {
      const windowsGuest = makeRow('sub-a', 'eastus', 'azure.vm.windows.guestmetrics', 'vm-guest');
      const linuxGuest = makeRow('sub-a', 'eastus', 'azure.vm.linux.guestmetrics', 'vm-guest');
      expect(isResourceRowDisabled(windowsGuest, [], true)).toBe(true);
      expect(isResourceRowDisabled(linuxGuest, [], true)).toBe(true);
    });

    it('disables Guest OS metric namespaces case-insensitively', () => {
      const windowsGuest = makeRow('sub-a', 'eastus', 'Azure.VM.Windows.GuestMetrics', 'vm-guest');
      expect(isResourceRowDisabled(windowsGuest, [], true)).toBe(true);
    });

    it('disables legacy Windows Azure Diagnostics namespaces, even as the first selection', () => {
      const wadShort = makeRow('sub-a', 'eastus', 'WAD', 'vm-wad');
      const wadDiagnostics = makeRow('sub-a', 'eastus', 'Windows Azure Diagnostics', 'vm-wad');
      expect(isResourceRowDisabled(wadShort, [], true)).toBe(true);
      expect(isResourceRowDisabled(wadDiagnostics, [], true)).toBe(true);
    });

    it('keeps standard resource-type namespaces selectable', () => {
      expect(isResourceRowDisabled(vmEastA, [], true)).toBe(false);
      expect(isResourceRowDisabled(storageEastA, [], true)).toBe(false);
    });
  });

  describe('batch API disabled', () => {
    it('allows the same subscription, region, and compatible namespace', () => {
      const vmEastA2 = makeRow('sub-a', 'eastus', 'Microsoft.Compute/virtualMachines', 'vm-a2');
      expect(isResourceRowDisabled(vmEastA2, [vmEastA], false)).toBe(false);
    });

    it('disables a row in a different subscription or region', () => {
      expect(isResourceRowDisabled(vmWestB, [vmEastA], false)).toBe(true);
    });
  });
});

describe('isBatchableNamespace', () => {
  it('treats standard resource-type namespaces as batchable', () => {
    expect(isBatchableNamespace('microsoft.compute/virtualmachines')).toBe(true);
    expect(isBatchableNamespace('Microsoft.Storage/storageAccounts')).toBe(true);
  });

  it('treats an empty or undefined namespace as batchable', () => {
    expect(isBatchableNamespace(undefined)).toBe(true);
    expect(isBatchableNamespace('')).toBe(true);
  });

  it('treats Guest OS metric namespaces as non-batchable', () => {
    expect(isBatchableNamespace('azure.vm.windows.guestmetrics')).toBe(false);
    expect(isBatchableNamespace('azure.vm.linux.guestmetrics')).toBe(false);
    expect(isBatchableNamespace('Azure.VM.Windows.GuestMetrics')).toBe(false);
  });

  it('treats legacy Windows Azure Diagnostics namespaces as non-batchable', () => {
    expect(isBatchableNamespace('Windows Azure Diagnostics')).toBe(false);
    expect(isBatchableNamespace('WAD')).toBe(false);
    expect(isBatchableNamespace('  wad  ')).toBe(false);
  });
});

describe('getSelectionNotice', () => {
  const selected: ResourceRowGroup = [vmEastA];

  it('mentions cross-subscription/region selection when the batch API is enabled', () => {
    expect(getSelectionNotice(selected, true)).toContain('across subscriptions and regions');
  });

  it('mentions same-location selection when the batch API is disabled', () => {
    expect(getSelectionNotice(selected, false)).toContain('same resource type and location');
  });
});
