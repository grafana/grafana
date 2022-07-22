import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { createMockInstanceSetttings } from '../../__mocks__/instanceSettings';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockResourcesByResourceGroup,
  mockSearchResults,
} from '../../__mocks__/resourcePickerRows';
import ResourcePickerData, { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';

import { ResourceRowType } from './types';

import ResourcePicker from '.';

const noResourceURI = '';
const singleSubscriptionSelectionURI = '/subscriptions/def-456';
const singleResourceGroupSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3';
const singleResourceSelectionURI =
  '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server';

const noop: any = () => {};
function createMockResourcePickerData() {
  const mockResourcePicker = new ResourcePickerData(createMockInstanceSetttings());

  mockResourcePicker.getSubscriptions = jest.fn().mockResolvedValue(createMockSubscriptions());
  mockResourcePicker.getResourceGroupsBySubscriptionId = jest
    .fn()
    .mockResolvedValue(createMockResourceGroupsBySubscription());
  mockResourcePicker.getResourcesForResourceGroup = jest.fn().mockResolvedValue(mockResourcesByResourceGroup());
  mockResourcePicker.getResourceURIFromWorkspace = jest.fn().mockReturnValue('');
  mockResourcePicker.getResourceURIDisplayProperties = jest.fn().mockResolvedValue({});
  mockResourcePicker.search = jest.fn().mockResolvedValue(mockSearchResults());

  return mockResourcePicker;
}

const queryType: ResourcePickerQueryType = 'logs';

const defaultProps = {
  templateVariables: [],
  resourceURI: noResourceURI,
  resourcePickerData: createMockResourcePickerData(),
  onCancel: noop,
  onApply: noop,
  selectableEntryTypes: [
    ResourceRowType.Subscription,
    ResourceRowType.ResourceGroup,
    ResourceRowType.Resource,
    ResourceRowType.Variable,
  ],
  queryType,
};

describe('AzureMonitor ResourcePicker', () => {
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  it('should pre-load subscriptions when there is no existing selection', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={noResourceURI} />);
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    const uncheckedCheckboxes = await screen.findAllByRole('checkbox', { checked: false });
    expect(uncheckedCheckboxes.length).toBe(3);
  });

  it('should show a subscription as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={singleSubscriptionSelectionURI} />);
    const subscriptionCheckboxes = await screen.findAllByLabelText('Dev Subscription');
    expect(subscriptionCheckboxes.length).toBe(2);
    expect(subscriptionCheckboxes[0]).toBeChecked();
    expect(subscriptionCheckboxes[1]).toBeChecked();
  });

  it('should show a resourceGroup as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={singleResourceGroupSelectionURI} />);
    const resourceGroupCheckboxes = await screen.findAllByLabelText('A Great Resource Group');
    expect(resourceGroupCheckboxes.length).toBe(2);
    expect(resourceGroupCheckboxes[0]).toBeChecked();
    expect(resourceGroupCheckboxes[1]).toBeChecked();
  });

  it('should show scroll down to a resource and mark it as selected if there is one saved', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={singleResourceSelectionURI} />);
    const resourceCheckboxes = await screen.findAllByLabelText('db-server');
    expect(resourceCheckboxes.length).toBe(2);
    expect(resourceCheckboxes[0]).toBeChecked();
    expect(resourceCheckboxes[1]).toBeChecked();
  });

  it('opens the selected nested resources', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={singleResourceSelectionURI} />);
    const collapseSubscriptionBtn = await screen.findByLabelText('Collapse Dev Subscription');
    expect(collapseSubscriptionBtn).toBeInTheDocument();
    const collapseResourceGroupBtn = await screen.findByLabelText('Collapse A Great Resource Group');
    expect(collapseResourceGroupBtn).toBeInTheDocument();
  });

  it('scrolls down to the selected resource', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={singleResourceSelectionURI} />);
    await screen.findByLabelText('Collapse A Great Resource Group');
    expect(window.HTMLElement.prototype.scrollIntoView).toBeCalledTimes(1);
  });

  it('should be able to expand a subscription when clicked and reveal resource groups', async () => {
    render(<ResourcePicker {...defaultProps} />);
    const expandSubscriptionButton = await screen.findByLabelText('Expand Primary Subscription');
    expect(expandSubscriptionButton).toBeInTheDocument();
    expect(screen.queryByLabelText('A Great Resource Group')).not.toBeInTheDocument();
    expandSubscriptionButton.click();
    expect(await screen.findByLabelText('A Great Resource Group')).toBeInTheDocument();
  });

  it('should call onApply with a new subscription uri when a user clicks on the checkbox in the row', async () => {
    const onApply = jest.fn();
    render(<ResourcePicker {...defaultProps} onApply={onApply} />);
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    subscriptionCheckbox.click();
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    applyButton.click();
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toBeCalledWith('/subscriptions/def-123');
  });

  it('should call onApply with a new subscription uri when a user types it in the selection box', async () => {
    const onApply = jest.fn();
    render(<ResourcePicker {...defaultProps} onApply={onApply} />);
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();

    const advancedSection = screen.getByText('Advanced');
    advancedSection.click();

    const advancedInput = await screen.findByLabelText('Resource URI');
    await userEvent.type(advancedInput, '/subscriptions/def-123');

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    applyButton.click();

    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toBeCalledWith('/subscriptions/def-123');
  });

  it('renders a search field which show search results when there are results', async () => {
    render(<ResourcePicker {...defaultProps} />);
    const searchRow1 = screen.queryByLabelText('search-result');
    expect(searchRow1).not.toBeInTheDocument();

    const searchField = await screen.findByLabelText('resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'sea');

    const searchRow2 = await screen.findByLabelText('search-result');
    expect(searchRow2).toBeInTheDocument();
  });

  it('renders no results if there are no search results', async () => {
    const rpd = createMockResourcePickerData();
    rpd.search = jest.fn().mockResolvedValue([]);

    render(<ResourcePicker {...defaultProps} resourcePickerData={rpd} />);

    const searchField = await screen.findByLabelText('resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'some search that has no results');

    const noResults = await screen.findByText('No resources found');
    expect(noResults).toBeInTheDocument();
  });

  it('renders a loading state while waiting for search results', async () => {
    const rpd = createMockResourcePickerData();
    rpd.search = jest.fn().mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          return resolve(mockSearchResults());
        }, 1); // purposely slow down call by a tick so as to force a loading state
      });
    });

    render(<ResourcePicker {...defaultProps} resourcePickerData={rpd} />);

    const searchField = await screen.findByLabelText('resource search');
    expect(searchField).toBeInTheDocument();

    await userEvent.type(searchField, 'sear');

    const loading = await screen.findByText('Loading...');
    expect(loading).toBeInTheDocument();

    const searchResult = await screen.findByLabelText('search-result');
    expect(searchResult).toBeInTheDocument();

    const loadingAfterResults = screen.queryByText('Loading...');
    expect(loadingAfterResults).not.toBeInTheDocument();
  });

  it('resets result when the user clears their search', async () => {
    render(<ResourcePicker {...defaultProps} resourceURI={noResourceURI} />);
    const subscriptionCheckboxBeforeSearch = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckboxBeforeSearch).toBeInTheDocument();

    const searchRow1 = screen.queryByLabelText('search-result');
    expect(searchRow1).not.toBeInTheDocument();

    const searchField = await screen.findByLabelText('resource search');
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

  describe('when rendering resource picker without any selectable entry types', () => {
    it('renders no checkboxes', async () => {
      await act(async () => {
        render(<ResourcePicker {...defaultProps} selectableEntryTypes={[]} />);
      });
      const checkboxes = screen.queryAllByRole('checkbox');
      expect(checkboxes.length).toBe(0);
    });
  });
});
