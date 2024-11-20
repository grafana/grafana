import {
  createARGResourcesResponse,
  createMockARGResourceGroupsResponse,
  createMockARGSubscriptionResponse,
} from '../__mocks__/argResourcePickerResponse';
import createMockDatasource from '../__mocks__/datasource';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import { resourceTypes } from '../azureMetadata';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { AzureGraphResponse } from '../types';

import ResourcePickerData from './resourcePickerData';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    replace: (val: string) => {
      return val;
    },
  }),
}));

const createResourcePickerData = (responses: AzureGraphResponse[], noNamespaces?: boolean) => {
  const instanceSettings = createMockInstanceSetttings();
  const mockDatasource = createMockDatasource();
  mockDatasource.azureMonitorDatasource.getMetricNamespaces = jest
    .fn()
    .mockResolvedValueOnce(
      noNamespaces ? [] : [{ text: 'Microsoft.Storage/storageAccounts', value: 'Microsoft.Storage/storageAccounts' }]
    );
  const resourcePickerData = new ResourcePickerData(instanceSettings, mockDatasource.azureMonitorDatasource);
  const postResource = jest.fn();
  responses.forEach((res) => {
    postResource.mockResolvedValueOnce(res);
  });
  resourcePickerData.postResource = postResource;
  return { resourcePickerData, postResource, mockDatasource };
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

    it('makes multiple requests when arg returns a skipToken and passes the right skipToken to each subsequent call', async () => {
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
      expect(postBody.query).toContain("type == 'microsoft.resources/subscriptions/resourcegroups'");
      expect(postBody.query).toContain("where subscriptionId == '123'");
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

    it('filters by metric specific resources', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResourceGroupsResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([
        mockSubscriptionsResponse,
        mockResourceGroupsResponse,
      ]);
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'metrics');

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

    it('throws an error if it recieves data with a malformed uri', async () => {
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
        await resourcePickerData.getResourcesForResourceGroup('dev', 'logs');
        throw Error('expected getResourcesForResourceGroup to fail but it succeeded');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toEqual('unable to fetch resource details');
        } else {
          throw err;
        }
      }
    });

    it('should filter metrics resources', async () => {
      const mockSubscriptionsResponse = createMockARGSubscriptionResponse();
      const mockResourcesResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([
        mockSubscriptionsResponse,
        mockResourcesResponse,
      ]);
      await resourcePickerData.getResourcesForResourceGroup('dev', 'metrics');

      expect(postResource).toBeCalledTimes(2);
      const secondCall = postResource.mock.calls[1];
      const [_, postBody] = secondCall;
      expect(postBody.query).toContain('microsoft.storage/storageaccounts');
    });
  });

  describe('search', () => {
    it('makes requests for metrics searches', async () => {
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
      const formattedResults = await resourcePickerData.search('vmname', 'metrics');
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
    it('metrics searches - fallback namespaces', async () => {
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
      await resourcePickerData.search('vmname', 'metrics');
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
      const formattedResults = await resourcePickerData.search('rgName', 'logs');
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
        await resourcePickerData.search('dev', 'logs');
        throw Error('expected search test to fail but it succeeded');
      } catch (err) {
        if (err instanceof Error) {
          expect(err.message).toEqual('unable to fetch resource details');
        } else {
          throw err;
        }
      }
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
