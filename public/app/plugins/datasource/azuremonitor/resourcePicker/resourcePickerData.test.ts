import { resourceTypes } from '../azureMetadata/resourceTypes';
import AzureResourceGraphDatasource from '../azure_resource_graph/azure_resource_graph_datasource';
import { ResourceRowType } from '../components/ResourcePicker/types';
import {
  createARGResourcesResponse,
  createMockARGResourceGroupsResponse,
  createMockARGSubscriptionResponse,
} from '../mocks/argResourcePickerResponse';
import createMockDatasource from '../mocks/datasource';
import { createMockInstanceSetttings } from '../mocks/instanceSettings';
import { type AzureGraphResponse } from '../types/types';

import ResourcePickerData from './resourcePickerData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

const createResourcePickerData = (responses: AzureGraphResponse[], noNamespaces?: boolean, cloudName?: string) => {
  const instanceSettings = createMockInstanceSetttings(cloudName ? { jsonData: { cloudName } } : undefined);
  const azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
  const postResource = jest.fn();
  responses.forEach((res) => {
    postResource.mockResolvedValueOnce(res);
  });
  azureResourceGraphDatasource.postResource = postResource;
  const mockDatasource = createMockDatasource({ azureResourceGraphDatasource: azureResourceGraphDatasource });
  mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest
    .fn()
    .mockResolvedValueOnce(
      noNamespaces ? [] : [{ text: 'Microsoft.Storage/storageAccounts', value: 'Microsoft.Storage/storageAccounts' }]
    );

  const resourcePickerData = new ResourcePickerData(
    instanceSettings,
    mockDatasource.azureMonitorDatasource,
    mockDatasource.azureResourceGraphDatasource
  );
  return { resourcePickerData, postResource, mockDatasource };
};

const emptyFilters = {
  subscriptions: [],
  types: [],
  locations: [],
};

describe('AzureMonitor resourcePickerData', () => {
  describe('getSubscriptions', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getSubscriptions();

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [path, postBody] = firstCall;
      expect(path).toEqual('resourcegraph/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01');
      expect(postBody.query).toContain("where type == 'microsoft.resources/subscriptions'");
    });
    it('returns formatted subscriptions', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData } = createResourcePickerData([mockResponse]);

      const subscriptions = await resourcePickerData.getSubscriptions();
      expect(subscriptions.length).toEqual(6);
      expect(subscriptions[0]).toEqual({
        id: '1',
        name: 'Primary Subscription',
        type: 'Subscription',
        typeLabel: 'Subscription',
        uri: '/subscriptions/1',
        children: [],
      });
    });

    it('makes multiple requests for subscriptions when arg returns a skipToken and passes the right skipToken to each subsequent call', async () => {
      const response1 = {
        ...createMockARGSubscriptionResponse(),
        $skipToken: 'skipfirst100',
      };
      const response2 = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([response1, response2]);

      await resourcePickerData.getSubscriptions();

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipfirst100');
    });

    it('makes multiple requests for resource groups when arg returns a skip token and passes the right skipToken to each subsequent call', async () => {
      const resourceGroupResponse1 = {
        ...createMockARGResourceGroupsResponse(),
        $skipToken: 'skipfirst100',
      };
      const resourceGroupResponse2 = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([
        resourceGroupResponse1,
        resourceGroupResponse2,
      ]);

      await resourcePickerData.getResourceGroupsBySubscriptionId('1', 'metrics');

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipfirst100');
    });

    it('makes multiple requests for resources when arg returns a skip token and passes the right skipToken to each subsequent call', async () => {
      const resourcesResponse1 = {
        ...createARGResourcesResponse(),
        $skipToken: 'skipfirst100',
      };
      const resourcesResponse2 = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([resourcesResponse1, resourcesResponse2]);

      await resourcePickerData.getResourcesForResourceGroup('resourceGroupURI', 'metrics');

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipfirst100');
    });

    it('returns a concatenates a formatted array of subscriptions when there are multiple pages from arg', async () => {
      const response1 = {
        ...createMockARGSubscriptionResponse(),
        $skipToken: 'skipfirst100',
      };
      const response2 = createMockARGSubscriptionResponse();
      const { resourcePickerData } = createResourcePickerData([response1, response2]);

      const subscriptions = await resourcePickerData.getSubscriptions();

      expect(subscriptions.length).toEqual(12);
      expect(subscriptions[0]).toEqual({
        id: '1',
        name: 'Primary Subscription',
        type: 'Subscription',
        typeLabel: 'Subscription',
        uri: '/subscriptions/1',
        children: [],
      });
    });

    it('throws an error if it does not recieve data from arg', async () => {
      const mockResponse = { data: [] };
      const { resourcePickerData } = createResourcePickerData([mockResponse]);
      try {
        await resourcePickerData.getSubscriptions();
        throw Error('expected getSubscriptions to fail but it succeeded');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toEqual('No subscriptions were found');
        } else {
          throw err;
        }
      }
    });

    it('applies subscription filters in the query', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: ['sub1', 'sub2'], types: [], locations: [] };
      await resourcePickerData.getSubscriptions(filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where subscriptionId in ("sub1","sub2")');
    });

    it('applies type filters in the query', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: ['microsoft.compute/virtualmachines'], locations: [] };
      await resourcePickerData.getSubscriptions(filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where type in ("microsoft.compute/virtualmachines")');
    });

    it('applies location filters in the query', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: [], locations: ['eastus', 'westeurope'] };
      await resourcePickerData.getSubscriptions(filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where location in ("eastus","westeurope")');
    });

    it('applies all filters together in the query', async () => {
      const mockResponse = createMockARGSubscriptionResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = {
        subscriptions: ['sub1'],
        types: ['microsoft.compute/virtualmachines'],
        locations: ['eastus'],
      };
      await resourcePickerData.getSubscriptions(filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where subscriptionId in ("sub1")');
      expect(postBody.query).toContain('| where type in ("microsoft.compute/virtualmachines")');
      expect(postBody.query).toContain('| where location in ("eastus")');
    });
  });

  describe('getResourceGroupsBySubscriptionId', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs');

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [path, postBody] = firstCall;
      expect(path).toEqual('resourcegraph/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01');
      expect(postBody.query).toContain(
        'extend resourceGroupURI = strcat("/subscriptions/", subscriptionId, "/resourcegroups/", resourceGroup)'
      );
      expect(postBody.query).toContain("where subscriptionId == '123'");
    });

    it('does not apply subscription filters in the query - only the supplied subscription is used', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: ['sub1', 'sub2'], types: [], locations: [] };
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where subscriptionId in ("123")');
    });

    it('applies type filters in the query', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: ['microsoft.compute/virtualmachines'], locations: [] };
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where type in ("microsoft.compute/virtualmachines")');
    });

    it('applies location filters in the query', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: [], locations: ['eastus', 'westeurope'] };
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where location in ("eastus","westeurope")');
    });

    it('returns formatted resourceGroups', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData } = createResourcePickerData([mockResponse]);

      const resourceGroups = await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs');
      expect(resourceGroups.length).toEqual(6);
      expect(resourceGroups[0]).toEqual({
        id: 'prod',
        name: 'Production',
        type: 'ResourceGroup',
        typeLabel: 'Resource Group',
        uri: '/subscriptions/abc-123/resourceGroups/prod',
        children: [],
      });
    });

    it('makes multiple requests when it is returned a skip token', async () => {
      const response1 = {
        ...createMockARGResourceGroupsResponse(),
        $skipToken: 'skipfirst100',
      };
      const response2 = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([response1, response2]);

      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs');

      expect(postResource).toHaveBeenCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.options.$skipToken).toEqual('skipfirst100');
    });

    it('returns a concatonized and formatted array of resourceGroups when there are multiple pages', async () => {
      const response1 = {
        ...createMockARGResourceGroupsResponse(),
        $skipToken: 'skipfirst100',
      };
      const response2 = createMockARGResourceGroupsResponse();
      const { resourcePickerData } = createResourcePickerData([response1, response2]);

      const resourceGroups = await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs');

      expect(resourceGroups.length).toEqual(12);
      expect(resourceGroups[0]).toEqual({
        id: 'prod',
        name: 'Production',
        type: 'ResourceGroup',
        typeLabel: 'Resource Group',
        uri: '/subscriptions/abc-123/resourceGroups/prod',
        children: [],
      });
    });

    it('throws an error if it recieves data with a malformed uri', async () => {
      const mockResponse = {
        data: [
          {
            resourceGroupURI: '/a-differently-formatted/uri/than/the/type/we/planned/to/parse',
            resourceGroupName: 'Production',
          },
        ],
      };
      const { resourcePickerData } = createResourcePickerData([mockResponse]);
      try {
        await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'logs');
        throw Error('expected getResourceGroupsBySubscriptionId to fail but it succeeded');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toEqual('unable to fetch resource groups');
        } else {
          throw err;
        }
      }
    });

    it('preserves namespace filtering for traces resource groups', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResourceGroupsResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([
        mockSubscriptionsResponse,
        mockResourceGroupsResponse,
      ]);
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'traces');

      expect(postResource).toBeCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.query).toContain('microsoft.storage/storageaccounts');
    });
  });

  describe('getResourcesForResourceGroup', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourcesForResourceGroup('/subscription/sub1/resourceGroups/dev', 'logs');

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [path, postBody] = firstCall;
      expect(path).toEqual('resourcegraph/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01');
      expect(postBody.query).toContain('resources');
      expect(postBody.query).toContain('where id hasprefix "/subscription/sub1/resourceGroups/dev/"');
    });

    it('applies subscription filters in the query', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: ['sub1', 'sub2'], types: [], locations: [] };
      await resourcePickerData.getResourcesForResourceGroup('/subscription/sub1/resourceGroups/dev', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where subscriptionId in ("sub1","sub2")');
    });

    it('applies type filters in the query', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: ['microsoft.compute/virtualmachines'], locations: [] };
      await resourcePickerData.getResourcesForResourceGroup('/subscription/sub1/resourceGroups/dev', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where type in ("microsoft.compute/virtualmachines")');
    });

    it('applies location filters in the query', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: [], locations: ['eastus', 'westeurope'] };
      await resourcePickerData.getResourcesForResourceGroup('/subscription/sub1/resourceGroups/dev', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where location in ("eastus","westeurope")');
    });

    it('returns formatted resources', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData } = createResourcePickerData([mockResponse]);

      const resources = await resourcePickerData.getResourcesForResourceGroup('dev', 'logs');

      expect(resources.length).toEqual(4);
      expect(resources[0]).toEqual({
        id: 'web-server',
        name: 'web-server',
        type: 'Resource',
        location: 'northeurope',
        locationDisplayName: 'northeurope',
        resourceGroupName: 'dev',
        typeLabel: 'Microsoft.Compute/virtualMachines',
        uri: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
      });
    });

    it('preserves namespace filtering for traces resources', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResourcesResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([
        mockSubscriptionsResponse,
        mockResourcesResponse,
      ]);
      await resourcePickerData.getResourcesForResourceGroup('dev', 'traces');

      expect(postResource).toBeCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.query).toContain('microsoft.storage/storageaccounts');
    });
  });

  describe('search', () => {
    it('preserves namespace discovery for traces searches', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();

      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
            name: 'vmName',
            type: 'microsoft.compute/virtualmachines',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource, mockDatasource } = createResourcePickerData([
        mockSubscriptionsResponse,
        mockResponse,
      ]);
      const formattedResults = await resourcePickerData.search('vmname', 'traces', emptyFilters);
      expect(postResource).toHaveBeenCalledTimes(2);
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'westeurope'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'eastus'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'japaneast'
      );
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.query).not.toContain('union resourcecontainers');
      expect(postBody.query).toContain('where id contains "vmname"');

      expect(formattedResults[0]).toEqual({
        id: 'vmname',
        name: 'vmName',
        type: 'Resource',
        location: 'northeurope',
        resourceGroupName: 'rgName',
        typeLabel: 'Virtual machines',
        uri: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
      });
    });

    it('applies subscription filters in the query', async () => {
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName',
            name: 'rgName',
            type: 'microsoft.resources/subscriptions/resourcegroups',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: ['sub1', 'sub2'], types: [], locations: [] };
      await resourcePickerData.search('rgName', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where subscriptionId in ("sub1","sub2")');
    });

    it('applies type filters in the query', async () => {
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName',
            name: 'rgName',
            type: 'microsoft.resources/subscriptions/resourcegroups',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: ['microsoft.compute/virtualmachines'], locations: [] };
      await resourcePickerData.search('rgName', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where type in ("microsoft.compute/virtualmachines")');
    });

    it('applies location filters in the query', async () => {
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName',
            name: 'rgName',
            type: 'microsoft.resources/subscriptions/resourcegroups',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const filters = { subscriptions: [], types: [], locations: ['eastus', 'westeurope'] };
      await resourcePickerData.search('rgName', 'logs', filters);
      const firstCall = postResource.mock.calls[0];
      const postBody = firstCall[1];
      expect(postBody.query).toContain('| where location in ("eastus","westeurope")');
    });
    it('traces searches retain fallback namespaces', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();

      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
            name: 'vmName',
            type: 'microsoft.compute/virtualmachines',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource, mockDatasource } = createResourcePickerData(
        [mockSubscriptionsResponse, mockResponse],
        true
      );
      await resourcePickerData.search('vmname', 'traces', emptyFilters);
      expect(postResource).toHaveBeenCalledTimes(2);
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'westeurope'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'eastus'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        {
          resourceUri: '/subscriptions/1',
        },
        false,
        'japaneast'
      );
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      const namespaces = (postBody.query as string).match(/\((.*?)\)/)?.[0].split(',');
      expect(namespaces?.length).toEqual(resourceTypes.length);
    });
    it('makes requests for logs searches', async () => {
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName',
            name: 'rgName',
            type: 'microsoft.resources/subscriptions/resourcegroups',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const formattedResults = await resourcePickerData.search('rgName', 'logs', emptyFilters);
      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [_, postBody] = firstCall;
      expect(postBody.query).toContain('union resourcecontainers');

      expect(formattedResults[0]).toEqual({
        id: 'rgName',
        name: 'rgName',
        type: 'ResourceGroup',
        location: 'northeurope',
        resourceGroupName: 'rgName',
        typeLabel: 'Resource groups',
        uri: '/subscriptions/subId/resourceGroups/rgName',
      });
    });
    it('throws an error if it receives data it can not parse', async () => {
      const mockResponse = {
        data: [
          {
            id: '/a-differently-formatted/uri/than/the/type/we/planned/to/parse',
            name: 'web-server',
            type: 'Microsoft.Compute/virtualMachines',
            resourceGroup: 'dev',
            subscriptionId: 'def-456',
            location: 'northeurope',
          },
        ],
      };
      const { resourcePickerData } = createResourcePickerData([mockResponse]);
      try {
        await resourcePickerData.search('dev', 'logs', emptyFilters);
        throw Error('expected search test to fail but it succeeded');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toEqual('unable to fetch resource details');
        } else {
          throw err;
        }
      }
    });

    it('uses US Government regions when cloud is AzureUSGovernment', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
            name: 'vmName',
            type: 'microsoft.compute/virtualmachines',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'usgovvirginia',
          },
        ],
      };
      const { resourcePickerData, mockDatasource } = createResourcePickerData(
        [mockSubscriptionsResponse, mockResponse],
        false,
        'govazuremonitor'
      );
      await resourcePickerData.search('vmname', 'traces', emptyFilters);
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        { resourceUri: '/subscriptions/1' },
        false,
        'usgovvirginia'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        { resourceUri: '/subscriptions/1' },
        false,
        'usgovarizona'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'westeurope'
      );
    });

    it('uses China regions when cloud is AzureChinaCloud', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
            name: 'vmName',
            type: 'microsoft.compute/virtualmachines',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'chinanorth3',
          },
        ],
      };
      const { resourcePickerData, mockDatasource } = createResourcePickerData(
        [mockSubscriptionsResponse, mockResponse],
        false,
        'chinaazuremonitor'
      );
      await resourcePickerData.search('vmname', 'traces', emptyFilters);
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        { resourceUri: '/subscriptions/1' },
        false,
        'chinanorth3'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).toHaveBeenCalledWith(
        { resourceUri: '/subscriptions/1' },
        false,
        'chinaeast3'
      );
      expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'westeurope'
      );
    });

    it('falls back to predefined namespaces when a region fetch throws', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResponse = {
        data: [
          {
            id: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
            name: 'vmName',
            type: 'microsoft.compute/virtualmachines',
            resourceGroup: 'rgName',
            subscriptionId: 'subId',
            location: 'northeurope',
          },
        ],
      };
      const instanceSettings = createMockInstanceSetttings();
      const azureResourceGraphDatasource = new AzureResourceGraphDatasource(instanceSettings);
      const postResource = jest.fn();
      [mockSubscriptionsResponse, mockResponse].forEach((res) => {
        postResource.mockResolvedValueOnce(res);
      });
      azureResourceGraphDatasource.postResource = postResource;
      const mockDatasource = createMockDatasource({ azureResourceGraphDatasource });
      mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest
        .fn()
        .mockRejectedValue(new Error('region not available'));

      const resourcePickerData = new ResourcePickerData(
        instanceSettings,
        mockDatasource.azureMonitorDatasource,
        mockDatasource.azureResourceGraphDatasource
      );

      await expect(resourcePickerData.search('vmname', 'traces', emptyFilters)).resolves.not.toThrow();
      const namespaces = resourcePickerData.supportedMetricNamespaces;
      expect(namespaces.length).toBeGreaterThan(0);
    });
  });

  describe('metrics resource discovery', () => {
    const filters = {
      subscriptions: ['sub2'],
      types: ['contoso.monitor/widgets'],
      locations: ['westus3'],
    };
    const resource = {
      id: '/subscriptions/sub2/resourceGroups/test-rg/providers/contoso.monitor/widgets/widget',
      name: 'widget',
      type: 'contoso.monitor/widgets',
      resourceGroup: 'test-rg',
      subscriptionId: 'sub2',
      location: 'westus3',
    };

    it.each([
      {
        name: 'search',
        fetch: (data: ResourcePickerData) => data.search('widget', 'metrics', filters),
        response: { data: [resource] },
        expectedQuery: `resources
          | where id contains "widget"
          | where subscriptionId in ("sub2")
          | where type in ("contoso.monitor/widgets")
          | where location in ("westus3")
          | order by tolower(name) asc
          | limit 200`,
        expectedName: 'widget',
      },
      {
        name: 'resource-group browsing',
        fetch: (data: ResourcePickerData) => data.getResourceGroupsBySubscriptionId('sub2', 'metrics', filters),
        response: {
          data: [
            {
              resourceGroupName: 'test-rg',
              resourceGroupURI: '/subscriptions/sub2/resourceGroups/test-rg',
            },
          ],
        },
        expectedQuery: `resources
          | where subscriptionId == 'sub2'
          | where subscriptionId in ("sub2")
          | where type in ("contoso.monitor/widgets")
          | where location in ("westus3")
          | extend resourceGroupURI = strcat("/subscriptions/", subscriptionId, "/resourcegroups/", resourceGroup)
          | join kind=leftouter (resourcecontainers
              | where type =~ 'microsoft.resources/subscriptions/resourcegroups'
              | project resourceGroupName=name, resourceGroupURI=tolower(id)) on resourceGroupURI
          | project resourceGroupName=iff(resourceGroupName != "", resourceGroupName, resourceGroup), resourceGroupURI
          | summarize count=count() by resourceGroupName, resourceGroupURI
          | order by tolower(resourceGroupName) asc`,
        expectedName: 'test-rg',
      },
      {
        name: 'resource browsing',
        fetch: (data: ResourcePickerData) =>
          data.getResourcesForResourceGroup('/subscriptions/sub2/resourceGroups/test-rg', 'metrics', filters),
        response: { data: [resource] },
        expectedQuery: `resources
          | where id hasprefix "/subscriptions/sub2/resourceGroups/test-rg/"
          | where subscriptionId in ("sub2")
          | where type in ("contoso.monitor/widgets")
          | where location in ("westus3")
          | order by tolower(name) asc`,
        expectedName: 'widget',
      },
    ])(
      'discovers an unlisted type through $name while preserving explicit filters',
      async ({ fetch, response, expectedQuery, expectedName }) => {
        const { resourcePickerData, postResource, mockDatasource } = createResourcePickerData([]);
        postResource.mockImplementation(async (_path, { query }) =>
          query.includes('join kind=inner') ? createMockARGSubscriptionResponse() : response
        );

        const rows = await fetch(resourcePickerData);

        expect(postResource.mock.calls.at(-1)[1].query.replace(/\s+/g, ' ').trim()).toBe(
          expectedQuery.replace(/\s+/g, ' ').trim()
        );
        expect(rows[0].name).toBe(expectedName);
        expect(resourceTypes).not.toContain('contoso.monitor/widgets');
        expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).not.toHaveBeenCalled();
        expect(postResource).toHaveBeenCalledTimes(1);
      }
    );

    it.each(['azuremonitor', 'govazuremonitor', 'chinaazuremonitor'])(
      'discovers resources without namespace sampling in %s',
      async (cloudName) => {
        const { resourcePickerData, postResource, mockDatasource } = createResourcePickerData([], false, cloudName);
        postResource.mockResolvedValue({ data: [resource] });
        mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest
          .fn()
          .mockRejectedValue(new Error('Namespace discovery is forbidden'));

        const rows = await resourcePickerData.search('widget', 'metrics', emptyFilters);

        expect(postResource.mock.calls[0][1].query.replace(/\s+/g, ' ').trim()).toBe(
          'resources | where id contains "widget" | order by tolower(name) asc | limit 200'
        );
        expect(rows[0].uri).toBe('/subscriptions/sub2/resourceGroups/test-rg/providers/contoso.monitor/widgets/widget');
        expect(mockDatasource.azureMonitorDatasource.getMetricNamespaces).not.toHaveBeenCalled();
      }
    );

    it('propagates resource discovery errors rather than returning an empty resource list', async () => {
      const { resourcePickerData, postResource } = createResourcePickerData([]);
      const error = new Error('Resource Graph access denied');
      postResource.mockRejectedValue(error);

      await expect(resourcePickerData.search('widget', 'metrics', emptyFilters)).rejects.toBe(error);
    });
  });

  describe('fetchInitialRows', () => {
    it('returns a list of subscriptions', async () => {
      const { resourcePickerData } = createResourcePickerData([createMockARGSubscriptionResponse()]);
      const rows = await resourcePickerData.fetchInitialRows('logs');
      expect(rows.length).toEqual(createMockARGSubscriptionResponse().data.length);
    });

    it('fetches resource groups and resources', async () => {
      const { resourcePickerData } = createResourcePickerData([createMockARGSubscriptionResponse()]);
      resourcePickerData.getResourceGroupsBySubscriptionId = jest
        .fn()
        .mockResolvedValue([{ id: 'rg1', uri: '/subscriptions/1/resourceGroups/rg1' }]);
      resourcePickerData.getResourcesForResourceGroup = jest.fn().mockResolvedValue([
        { id: 'vm1', uri: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1' },
        { id: 'vm2', uri: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm2' },
      ]);
      const rows = await resourcePickerData.fetchInitialRows('logs', [
        {
          subscription: '1',
          resourceGroup: 'rg1',
          resourceName: 'vm1',
          metricNamespace: 'Microsoft.Compute/virtualMachines',
        },
        {
          subscription: '1',
          resourceGroup: 'rg1',
          resourceName: 'vm2',
          metricNamespace: 'Microsoft.Compute/virtualMachines',
        },
      ]);
      expect(rows[0]).toMatchObject({
        id: '1',
        children: [
          {
            id: 'rg1',
            children: [{ id: 'vm1' }, { id: 'vm2' }],
          },
        ],
      });
      // getResourceGroupsBySubscriptionId should only be called once because the subscription
      // of both resources is the same
      expect(resourcePickerData.getResourceGroupsBySubscriptionId).toBeCalledTimes(1);
      // getResourcesForResourceGroup should only be called once because the resource group
      // of both resources is the same
      expect(resourcePickerData.getResourcesForResourceGroup).toBeCalledTimes(1);
    });

    it('fetches filtered resource groups and resources', async () => {
      const { resourcePickerData } = createResourcePickerData([createMockARGSubscriptionResponse()]);
      resourcePickerData.getResourceGroupsBySubscriptionId = jest
        .fn()
        .mockResolvedValue([{ id: 'rg1', uri: '/subscriptions/1/resourceGroups/rg1' }]);
      resourcePickerData.getResourcesForResourceGroup = jest.fn().mockResolvedValue([
        { id: 'vm1', uri: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm1' },
        { id: 'vm2', uri: '/subscriptions/1/resourceGroups/rg1/providers/Microsoft.Compute/virtualMachines/vm2' },
      ]);
      const filters = { subscriptions: ['1'], types: [], locations: [] };
      const rows = await resourcePickerData.fetchInitialRows(
        'logs',
        [
          {
            subscription: '1',
            resourceGroup: 'rg1',
            resourceName: 'vm1',
            metricNamespace: 'Microsoft.Compute/virtualMachines',
          },
          {
            subscription: '1',
            resourceGroup: 'rg1',
            resourceName: 'vm2',
            metricNamespace: 'Microsoft.Compute/virtualMachines',
          },
        ],
        filters
      );
      expect(rows[0]).toMatchObject({
        id: '1',
        children: [
          {
            id: 'rg1',
            children: [{ id: 'vm1' }, { id: 'vm2' }],
          },
        ],
      });
      expect(resourcePickerData.getResourceGroupsBySubscriptionId).toBeCalledTimes(1);
      expect(resourcePickerData.getResourcesForResourceGroup).toBeCalledTimes(1);
    });

    it('fetches resource groups for distinct subscriptions in parallel', async () => {
      const { resourcePickerData } = createResourcePickerData([createMockARGSubscriptionResponse()]);

      let inFlight = 0;
      let maxInFlight = 0;
      resourcePickerData.getResourceGroupsBySubscriptionId = jest.fn().mockImplementation(async (subId: string) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return [{ id: `rg-${subId}`, uri: `/subscriptions/${subId}/resourceGroups/rg-${subId}` }];
      });
      resourcePickerData.getResourcesForResourceGroup = jest.fn().mockResolvedValue([]);

      await resourcePickerData.fetchInitialRows('logs', [
        { subscription: '1', resourceGroup: 'rg-1', metricNamespace: 'Microsoft.Compute/virtualMachines' },
        { subscription: '2', resourceGroup: 'rg-2', metricNamespace: 'Microsoft.Compute/virtualMachines' },
        { subscription: '3', resourceGroup: 'rg-3', metricNamespace: 'Microsoft.Compute/virtualMachines' },
      ]);

      expect(resourcePickerData.getResourceGroupsBySubscriptionId).toBeCalledTimes(3);
      expect(maxInFlight).toBeGreaterThan(1);
    });
  });

  describe('parseRows', () => {
    [
      {
        input: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
        expected: {
          id: 'web-server',
          name: 'web-server',
          type: ResourceRowType.Resource,
          uri: '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
          typeLabel: 'Virtual machines',
        },
      },
      {
        input: {
          subscription: 'def-456',
        },
        expected: {
          id: 'def-456',
          name: 'def-456',
          type: ResourceRowType.Subscription,
          uri: '/subscriptions/def-456',
          typeLabel: '',
        },
      },
    ].forEach(({ input, expected }) => {
      const { resourcePickerData } = createResourcePickerData([]);
      expect(resourcePickerData.parseRows([input])[0]).toMatchObject(expected);
    });
  });
});
