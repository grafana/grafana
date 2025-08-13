import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { omit } from 'lodash';

import Datasource from '../../datasource';
import { selectors } from '../../e2e/selectors';
import createMockDatasource, { createMockLocations, createMockMetricsNamespaces } from '../../mocks/datasource';
import { createMockInstanceSetttings } from '../../mocks/instanceSettings';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockResourcesByResourceGroup,
  mockSearchResults,
} from '../../mocks/resourcePickerRows';
import { DeepPartial } from '../../mocks/utils';
import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';

import { ResourceRowType } from './types';

import ResourcePicker from '.';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
  config: {
    featureToggles: {
      azureResourcePickerUpdates: true,
    },
  },
}));

const noResourceURI = '';
const singleSubscriptionSelectionURI = '/subscriptions/def-456';
const singleResourceGroupSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3';
const singleResourceSelectionURI =
  '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server';

const noop = () => {};
function createMockResourcePickerData(
  preserveImplementation?: string[],
  datasourceOverrides?: DeepPartial<Datasource>
) {
  const mockDatasource = createMockDatasource(datasourceOverrides);
  const mockResourcePicker = new ResourcePickerData(
    createMockInstanceSetttings(),
    mockDatasource.azureMonitorDatasource,
    mockDatasource.azureResourceGraphDatasource
  );

  const mockFunctions = omit(
    {
      getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
      getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
      getResourcesForResourceGroup: jest.fn().mockResolvedValue(mockResourcesByResourceGroup()),
      getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
      getResourceURIDisplayProperties: jest.fn().mockResolvedValue({}),
      search: jest.fn().mockResolvedValue(mockSearchResults()),
    },
    preserveImplementation || []
  );

  return Object.assign(mockResourcePicker, mockFunctions);
}

const queryType: ResourcePickerQueryType = 'logs';
const resourcePickerData = createMockResourcePickerData();
const defaultProps = {
  templateVariables: [],
  resources: [],
  resourcePickerData,
  datasource: createMockDatasource({
    resourcePickerData,
    getSubscriptions: jest
      .fn()
      .mockResolvedValue(createMockSubscriptions().map((sub) => ({ label: sub.name, value: sub.id }))),
    getLocations: jest.fn().mockResolvedValue(createMockLocations()),
    getMetricNamespaces: jest.fn().mockResolvedValue(createMockMetricsNamespaces()),
  }),
  onCancel: noop,
  onApply: noop,
  selectableEntryTypes: [
    ResourceRowType.Subscription,
    ResourceRowType.ResourceGroup,
    ResourceRowType.Resource,
    ResourceRowType.Variable,
  ],
  queryType,
  disableRow: jest.fn(),
  renderAdvanced: jest.fn(),
};

describe('AzureMonitor ResourcePicker', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    config.featureToggles.azureResourcePickerUpdates = false;
  });
  it('should pre-load subscriptions when there is no existing selection', async () => {
    render(<ResourcePicker {...defaultProps} resources={[noResourceURI]} />);
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    const uncheckedCheckboxes = await screen.findAllByRole('checkbox', { checked: false });
    expect(uncheckedCheckboxes.length).toBe(3);
  });

  it('should show a subscription as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resources={[singleSubscriptionSelectionURI]} />);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Dev Subscription')).toHaveLength(2);
    });
    const subscriptionCheckboxes = await screen.findAllByLabelText('Dev Subscription');
    expect(subscriptionCheckboxes[0]).toBeChecked();
    expect(subscriptionCheckboxes[1]).toBeChecked();
  });

  it('should show a resourceGroup as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resources={[singleResourceGroupSelectionURI]} />);
    await waitFor(() => {
      expect(screen.getAllByLabelText('A Great Resource Group')).toHaveLength(2);
    });
    const resourceGroupCheckboxes = await screen.findAllByLabelText('A Great Resource Group');
    expect(resourceGroupCheckboxes[0]).toBeChecked();
    expect(resourceGroupCheckboxes[1]).toBeChecked();
  });

  it('should show scroll down to a resource and mark it as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resources={[singleResourceSelectionURI]} />);
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByLabelText('db-server')).toHaveLength(2);
    });
    const resourceCheckboxes = await screen.findAllByLabelText('db-server');
    expect(resourceCheckboxes[0]).toBeChecked();
    expect(resourceCheckboxes[1]).toBeChecked();
  });

  it('opens the selected nested resources', async () => {
    render(<ResourcePicker {...defaultProps} resources={[singleResourceSelectionURI]} />);
    const collapseSubscriptionBtn = await screen.findByLabelText('Collapse Dev Subscription');
    expect(collapseSubscriptionBtn).toBeInTheDocument();
    const collapseResourceGroupBtn = await screen.findByLabelText('Collapse A Great Resource Group');
    expect(collapseResourceGroupBtn).toBeInTheDocument();
  });

  it('scrolls down to the selected resource', async () => {
    render(<ResourcePicker {...defaultProps} resources={[singleResourceSelectionURI]} />);
    await screen.findByLabelText('Collapse A Great Resource Group');
    expect(window.HTMLElement.prototype.scrollIntoView).toBeCalledTimes(1);
  });

  it('should be able to expand a subscription when clicked and reveal resource groups', async () => {
    render(<ResourcePicker {...defaultProps} />);
    const expandSubscriptionButton = await screen.findByLabelText('Expand Primary Subscription');
    expect(expandSubscriptionButton).toBeInTheDocument();
    expect(screen.queryByLabelText('A Great Resource Group')).not.toBeInTheDocument();
    await userEvent.click(expandSubscriptionButton);
    expect(await screen.findByLabelText('A Great Resource Group')).toBeInTheDocument();
  });

  it('should call onApply with a new subscription uri when a user clicks on the checkbox in the row', async () => {
    const onApply = jest.fn();
    render(<ResourcePicker {...defaultProps} onApply={onApply} />);
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    await userEvent.click(subscriptionCheckbox);
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    expect(applyButton).toBeEnabled();
    await userEvent.click(applyButton);
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith(['/subscriptions/def-123']);
  });

  it('should call onApply removing an element', async () => {
    const onApply = jest.fn();
    render(<ResourcePicker {...defaultProps} resources={['/subscriptions/def-123']} onApply={onApply} />);
    await waitFor(() => {
      expect(screen.getAllByLabelText('Primary Subscription')).toHaveLength(2);
    });
    const subscriptionCheckbox = await screen.findAllByLabelText('Primary Subscription');
    expect(subscriptionCheckbox.at(0)).toBeChecked();
    await userEvent.click(subscriptionCheckbox.at(0)!);
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('should call onApply removing an element ignoring the case', async () => {
    const onApply = jest.fn();
    render(
      <ResourcePicker {...defaultProps} resources={['/subscriptions/def-456/resourceGroups/DEV-3']} onApply={onApply} />
    );
    await waitFor(() => {
      expect(screen.getAllByLabelText('A Great Resource Group')).toHaveLength(2);
    });
    const subscriptionCheckbox = await screen.findAllByLabelText('A Great Resource Group');
    expect(subscriptionCheckbox.at(0)).toBeChecked();
    await userEvent.click(subscriptionCheckbox.at(0)!);
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('should call onApply with a new resource when a user clicks on the checkbox in the row', async () => {
    const onApply = jest.fn();
    render(<ResourcePicker {...defaultProps} queryType={'metrics'} onApply={onApply} resources={[]} />);

    const subscriptionButton = await screen.findByRole('button', { name: 'Expand Primary Subscription' });
    expect(subscriptionButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expand A Great Resource Group' })).not.toBeInTheDocument();
    await userEvent.click(subscriptionButton);

    const resourceGroupButton = await screen.findByRole('button', { name: 'Expand A Great Resource Group' });
    await userEvent.click(resourceGroupButton);
    const checkbox = await screen.findByLabelText('web-server');
    await userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);

    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([
      {
        metricNamespace: 'Microsoft.Compute/virtualMachines',
        region: 'northeurope',
        resourceGroup: 'dev-3',
        resourceName: 'web-server',
        subscription: 'def-456',
      },
    ]);
  });

  it('should call onApply removing a resource element', async () => {
    const onApply = jest.fn();
    render(
      <ResourcePicker
        {...defaultProps}
        onApply={onApply}
        resources={[
          {
            metricNamespace: 'Microsoft.Compute/virtualMachines',
            region: 'northeurope',
            resourceGroup: 'dev-3',
            resourceName: 'web-server',
            subscription: 'def-456',
          },
        ]}
      />
    );
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByLabelText('web-server')).toHaveLength(2);
    });
    const checkbox = await screen.findAllByLabelText('web-server');
    expect(checkbox.at(0)).toBeChecked();
    await userEvent.click(checkbox.at(0)!);
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    await userEvent.click(applyButton);
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('renders a search field which show search results when there are results', async () => {
    render(<ResourcePicker {...defaultProps} />);
    const searchRow1 = screen.queryByLabelText('search-result');
    expect(searchRow1).not.toBeInTheDocument();

    const searchField = await screen.findByLabelText('Resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'sea');

    const searchRow2 = await screen.findByLabelText('search-result');
    expect(searchRow2).toBeInTheDocument();
  });

  it('renders no results if there are no search results', async () => {
    const rpd = createMockResourcePickerData();
    rpd.search = jest.fn().mockResolvedValue([]);

    render(<ResourcePicker {...defaultProps} resourcePickerData={rpd} />);

    const searchField = await screen.findByLabelText('Resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'some search that has no results');

    const noResults = await screen.findByText('No resources found');
    expect(noResults).toBeInTheDocument();
  });

  it('renders a loading state while waiting for search results', async () => {
    const rpd = createMockResourcePickerData();
    let promiseResolver: (value: unknown) => void = () => {};
    const promiseToResolve = new Promise((resolve) => {
      promiseResolver = resolve;
    });
    rpd.search = jest.fn().mockImplementation(() => promiseToResolve);

    render(<ResourcePicker {...defaultProps} resourcePickerData={rpd} />);

    const searchField = await screen.findByLabelText('Resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'sear');

    const loading = await screen.findByText('Loading...');
    expect(loading).toBeInTheDocument();

    // resolve the promise
    promiseResolver(mockSearchResults());

    const searchResult = await screen.findByLabelText('search-result');
    expect(searchResult).toBeInTheDocument();

    const loadingAfterResults = screen.queryByText('Loading...');
    expect(loadingAfterResults).not.toBeInTheDocument();
  });

  it('resets result when the user clears their search', async () => {
    render(<ResourcePicker {...defaultProps} resources={[noResourceURI]} />);
    const subscriptionCheckboxBeforeSearch = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckboxBeforeSearch).toBeInTheDocument();

    const searchRow1 = screen.queryByLabelText('search-result');
    expect(searchRow1).not.toBeInTheDocument();

    const searchField = await screen.findByLabelText('Resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'sea');

    const searchRow2 = await screen.findByLabelText('search-result');
    expect(searchRow2).toBeInTheDocument();

    const subscriptionCheckboxAfterSearch = screen.queryByLabelText('Primary Subscription');
    expect(subscriptionCheckboxAfterSearch).not.toBeInTheDocument();

    await userEvent.clear(searchField);

    const subscriptionCheckboxAfterClear = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckboxAfterClear).toBeInTheDocument();
  });

  it('should not throw an error if no namespaces are found - fallback used', async () => {
    const resourcePickerData = createMockResourcePickerData(['getResourceGroupsBySubscriptionId'], {
      azureResourceGraphDatasource: { getResourceGroups: jest.fn().mockResolvedValue([]) },
    });
    resourcePickerData.postResource = jest.fn().mockResolvedValueOnce({ data: [] });
    render(
      <ResourcePicker
        {...defaultProps}
        queryType={'metrics'}
        resourcePickerData={resourcePickerData}
        resources={[noResourceURI]}
      />
    );
    const subscriptionExpand = await screen.findByLabelText('Expand Primary Subscription');
    await userEvent.click(subscriptionExpand);
    const error = await screen.queryByRole('alert');
    expect(error).toBeNull();
  });

  it('display a row for a selected resource even if it is not part of the current rows', async () => {
    const resourcePickerData = createMockResourcePickerData([]);
    resourcePickerData.fetchInitialRows = jest.fn().mockResolvedValue([]);
    render(
      <ResourcePicker
        {...defaultProps}
        resources={[
          {
            metricNamespace: 'Microsoft.Compute/virtualMachines',
            region: 'northeurope',
            resourceGroup: 'dev-3',
            resourceName: 'web-server',
            subscription: 'def-456',
          },
        ]}
        resourcePickerData={resourcePickerData}
      />
    );
    const checkbox = await screen.findAllByLabelText('web-server');
    expect(checkbox).toHaveLength(1);
    expect(checkbox.at(0)).toBeChecked();
  });

  describe('when rendering resource picker without any selectable entry types', () => {
    it('renders no checkboxes', async () => {
      await act(async () => {
        render(<ResourcePicker {...defaultProps} selectableEntryTypes={[]} />);
      });
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);
    });
  });

  describe('filters', () => {
    beforeEach(() => {
      config.featureToggles.azureResourcePickerUpdates = true;
    });
    it('should not render filters if feature toggle disabled', async () => {
      config.featureToggles.azureResourcePickerUpdates = false;
      await act(async () => render(<ResourcePicker {...defaultProps} queryType="metrics" />));

      expect(
        screen.queryByTestId(selectors.components.queryEditor.resourcePicker.filters.subscription.input)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.queryEditor.resourcePicker.filters.type.input)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(selectors.components.queryEditor.resourcePicker.filters.location.input)
      ).not.toBeInTheDocument();
    });

    it('should render subscription filter and load subscription options', async () => {
      await act(async () => render(<ResourcePicker {...defaultProps} />));

      await waitFor(() => {
        expect(defaultProps.datasource.getSubscriptions).toHaveBeenCalled();
      });

      const subscriptionFilter = screen.getByTestId(
        selectors.components.queryEditor.resourcePicker.filters.subscription.input
      );
      expect(subscriptionFilter).toBeInTheDocument();
    });

    it('should render resource type filter for metrics query type', async () => {
      const metricsProps = { ...defaultProps, queryType: 'metrics' as ResourcePickerQueryType };
      await act(async () => render(<ResourcePicker {...metricsProps} />));

      await waitFor(() => {
        expect(defaultProps.datasource.getMetricNamespaces).toHaveBeenCalled();
      });

      const resourceTypeFilter = screen.getByTestId(selectors.components.queryEditor.resourcePicker.filters.type.input);
      expect(resourceTypeFilter).toBeInTheDocument();
    });

    it('should not render resource type filter for logs query type', async () => {
      const logsProps = { ...defaultProps, queryType: 'logs' as ResourcePickerQueryType };
      await act(async () => render(<ResourcePicker {...logsProps} />));

      const resourceTypeFilter = screen.queryByTestId(
        selectors.components.queryEditor.resourcePicker.filters.type.input
      );
      expect(resourceTypeFilter).not.toBeInTheDocument();
    });

    it('should render location filter and load location options', async () => {
      await act(async () => render(<ResourcePicker {...defaultProps} />));

      await waitFor(() => {
        expect(defaultProps.datasource.getLocations).toHaveBeenCalled();
      });

      const locationFilter = screen.getByTestId(selectors.components.queryEditor.resourcePicker.filters.location.input);
      expect(locationFilter).toBeInTheDocument();
    });

    // Combobox tests seem to be quite finnicky when it comes to selecting options
    // I've had to add multiple {ArrowDown} key-presses as sometimes the expected option isn't
    // at the top of the list
    it('should call fetchFiltered when subscription filter changes', async () => {
      const user = userEvent.setup();
      const mockFetchFiltered = jest.spyOn(resourcePickerData, 'fetchFiltered');

      await act(async () => render(<ResourcePicker {...defaultProps} />));

      const subscriptionFilter = await screen.getByTestId(
        selectors.components.queryEditor.resourcePicker.filters.subscription.input
      );
      await act(async () => {
        await user.click(subscriptionFilter);
        await user.type(subscriptionFilter, 'Primary Subscription {ArrowDown}{ArrowDown}{ArrowDown}{Enter}');
      });

      await waitFor(() => {
        expect(mockFetchFiltered).toHaveBeenCalledWith(
          'logs',
          expect.objectContaining({
            subscriptions: ['def-456'],
            types: [],
            locations: [],
          })
        );
      });
    });

    it('should call fetchFiltered when location filter changes', async () => {
      const user = userEvent.setup();
      const mockFetchFiltered = jest.spyOn(resourcePickerData, 'fetchFiltered');

      await act(async () => render(<ResourcePicker {...defaultProps} />));

      const locationFilter = await screen.getByTestId(
        selectors.components.queryEditor.resourcePicker.filters.location.input
      );
      await act(async () => {
        await user.click(locationFilter);
      });
      await user.type(locationFilter, 'North Europe{ArrowDown}{Enter}');

      await waitFor(() => {
        expect(mockFetchFiltered).toHaveBeenCalledWith(
          'logs',
          expect.objectContaining({
            subscriptions: [],
            types: [],
            locations: ['northeurope'],
          })
        );
      });
    });

    it('should call fetchFiltered when resource type filter changes for metrics', async () => {
      const user = userEvent.setup();
      const metricsProps = { ...defaultProps, queryType: 'metrics' as ResourcePickerQueryType };
      const mockFetchFiltered = jest.spyOn(resourcePickerData, 'fetchFiltered');

      await act(async () => render(<ResourcePicker {...metricsProps} />));

      const typeFilter = await screen.getByTestId(selectors.components.queryEditor.resourcePicker.filters.type.input);
      await act(async () => {
        await user.click(typeFilter);
      });

      await user.type(typeFilter, 'Kubernetes services {ArrowDown}{Enter}');
      await waitFor(() => {
        expect(mockFetchFiltered).toHaveBeenCalledWith(
          'metrics',
          expect.objectContaining({
            subscriptions: [],
            types: ['microsoft.containerservice/managedclusters'],
            locations: [],
          })
        );
      });
    });
  });
});
