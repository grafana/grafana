import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import ResourcePicker from '.';
import createMockResourcePickerData from '../../__mocks__/resourcePickerData';
import {
  createMockResourceGroupsBySubscription,
  createMockSubscriptions,
  mockResourcesByResourceGroup,
} from '../../__mocks__/resourcePickerRows';

const noResourceURI = '';
const singleSubscriptionSelectionURI = 'def-456';
const singleResourceGroupSelectionURI = '/subscriptions/def-456/resourceGroups/dev-3';
const singleResourceSelectionURI =
  '/subscriptions/def-456/resourceGroups/dev-3/providers/Microsoft.Compute/virtualMachines/db-serverproviders/Microsoft.Compute/virtualMachines/db-server';

describe('AzureMonitor ResourcePicker', () => {
  const noop: any = () => {};

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = function () {};
  });
  describe('when rendering the resource picker without a selection', () => {
    it('should load subscriptions', async () => {
      const resourePickerDataMock = createMockResourcePickerData({
        getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
        getResourceGroupsBySubscriptionId: jest.fn(),
        getResourcesForResourceGroup: jest.fn(),
      });
      await act(() => {
        render(
          <ResourcePicker
            templateVariables={[]}
            resourcePickerData={resourePickerDataMock}
            resourceURI={noResourceURI}
            onCancel={noop}
            onApply={noop}
          />
        );
      });

      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      expect(resourePickerDataMock.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).not.toHaveBeenCalled();
      expect(resourePickerDataMock.getResourcesForResourceGroup).not.toHaveBeenCalled();
    });
  });

  describe('when rendering the resource picker with a subscription selected', () => {
    it('should load subscriptions once', async () => {
      const resourePickerDataMock = createMockResourcePickerData({
        getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
        getResourceGroupsBySubscriptionId: jest.fn(),
        getResourcesForResourceGroup: jest.fn(),
      });
      await act(async () => {
        render(
          <ResourcePicker
            templateVariables={[]}
            resourcePickerData={resourePickerDataMock}
            resourceURI={singleSubscriptionSelectionURI}
            onCancel={noop}
            onApply={noop}
          />
        );
      });

      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      expect(resourePickerDataMock.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).not.toHaveBeenCalled();
      expect(resourePickerDataMock.getResourcesForResourceGroup).not.toHaveBeenCalled();
    });
  });

  describe('when rendering the resource picker with a resource group selected', () => {
    it('should load subscriptions and resource groups for its parent subscription once', async () => {
      const resourePickerDataMock = createMockResourcePickerData({
        getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
        getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
        getResourcesForResourceGroup: jest.fn(),
      });
      await act(async () => {
        render(
          <ResourcePicker
            templateVariables={[]}
            resourcePickerData={resourePickerDataMock}
            resourceURI={singleResourceGroupSelectionURI}
            onCancel={noop}
            onApply={noop}
          />
        );
      });

      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      expect(resourePickerDataMock.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).toHaveBeenLastCalledWith(
        singleSubscriptionSelectionURI
      );
      expect(resourePickerDataMock.getResourcesForResourceGroup).not.toHaveBeenCalled();
    });
  });

  describe('when rendering the resource picker with a resource selected', () => {
    it('should load subscriptions, resource groups and resources once', async () => {
      const resourePickerDataMock = createMockResourcePickerData({
        getSubscriptions: jest.fn().mockResolvedValue(createMockSubscriptions()),
        getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue(createMockResourceGroupsBySubscription()),
        getResourcesForResourceGroup: jest.fn().mockResolvedValue(mockResourcesByResourceGroup()),
      });
      await act(async () => {
        render(
          <ResourcePicker
            templateVariables={[]}
            resourcePickerData={resourePickerDataMock}
            resourceURI={singleResourceSelectionURI}
            onCancel={noop}
            onApply={noop}
          />
        );
      });

      await waitFor(() => expect(screen.getByText('Primary Subscription')).toBeInTheDocument());
      expect(resourePickerDataMock.getSubscriptions).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourceGroupsBySubscriptionId).toHaveBeenLastCalledWith(
        singleSubscriptionSelectionURI
      );
      expect(resourePickerDataMock.getResourcesForResourceGroup).toHaveBeenCalledTimes(1);
      expect(resourePickerDataMock.getResourcesForResourceGroup).toHaveBeenLastCalledWith(
        singleResourceGroupSelectionURI
      );
    });
  });
});
