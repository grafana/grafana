import { render, screen } from '@testing-library/react';
import React from 'react';

import ResourcePicker from '.';
import createMockResourcePickerData from '../../__mocks__/resourcePickerData';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockResourcesByResourceGroup,
} from '../../__mocks__/resourcePickerRows';

const noResourceURI = '';
const singleSubscriptionSelectionURI = '/subscriptions/def-456';
const singleResourceGroupSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3';
const singleResourceSelectionURI =
  '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-server';

const createResourcePickerDataMock = () => {
  return createMockResourcePickerData({
    getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
    getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
    getResourcesForResourceGroup: jest.fn().mockResolvedValue(mockResourcesByResourceGroup()),
  });
};
describe('AzureMonitor ResourcePicker', () => {
  const noop: any = () => {};
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  it('should pre-load subscriptions when there is no existing selection', async () => {
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={noResourceURI}
        onCancel={noop}
        onApply={noop}
      />
    );
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    const uncheckedCheckboxes = await screen.findAllByRole('checkbox', { checked: false });
    expect(uncheckedCheckboxes.length).toBe(3);
  });

  it('should show a subscription as selected if there is one saved', async () => {
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={singleSubscriptionSelectionURI}
        onCancel={noop}
        onApply={noop}
      />
    );
    const subscriptionCheckbox = await screen.findByLabelText('Dev Subscription');
    expect(subscriptionCheckbox).toBeChecked();
  });

  it('should show a resource group as selected if there is one saved', async () => {
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={singleResourceGroupSelectionURI}
        onCancel={noop}
        onApply={noop}
      />
    );
    const resourceGroupCheckbox = await screen.findByLabelText('A Great Resource Group');
    expect(resourceGroupCheckbox).toBeChecked();
  });

  it('should show a resource as selected if there is one saved', async () => {
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={singleResourceSelectionURI}
        onCancel={noop}
        onApply={noop}
      />
    );

    const resourceCheckbox = await screen.findByLabelText('db-server');
    expect(resourceCheckbox).toBeChecked();
  });

  it('should be able to expand a subscription when clicked and reveal resource groups', async () => {
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={noResourceURI}
        onCancel={noop}
        onApply={noop}
      />
    );
    const expandSubscriptionButton = await screen.findByLabelText('Expand Primary Subscription');
    expect(expandSubscriptionButton).toBeInTheDocument();
    expect(screen.queryByLabelText('A Great Resource Group')).not.toBeInTheDocument();
    expandSubscriptionButton.click();
    expect(await screen.findByLabelText('A Great Resource Group')).toBeInTheDocument();
  });

  it('should call onApply with a new subscription uri when a user selects it', async () => {
    const onApply = jest.fn();
    render(
      <ResourcePicker
        templateVariables={[]}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={noResourceURI}
        onCancel={noop}
        onApply={onApply}
      />
    );
    const subscriptionCheckbox = await screen.findByLabelText('Primary Subscription');
    expect(subscriptionCheckbox).toBeInTheDocument();
    expect(subscriptionCheckbox).not.toBeChecked();
    subscriptionCheckbox.click();
    const applyButton = screen.getByRole('button', { name: 'Apply' });
    applyButton.click();
    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toBeCalledWith('/subscriptions/def-123');
  });

  it('should call onApply with a template variable when a user selects it', async () => {
    const onApply = jest.fn();
    render(
      <ResourcePicker
        templateVariables={['$workspace']}
        resourcePickerData={createResourcePickerDataMock()}
        resourceURI={noResourceURI}
        onCancel={noop}
        onApply={onApply}
      />
    );

    const expandButton = await screen.findByLabelText('Expand Template variables');
    expandButton.click();

    const workSpaceCheckbox = await screen.findByLabelText('$workspace');
    workSpaceCheckbox.click();

    const applyButton = screen.getByRole('button', { name: 'Apply' });
    applyButton.click();

    expect(onApply).toBeCalledTimes(1);
    expect(onApply).toBeCalledWith('$workspace');
  });
});
