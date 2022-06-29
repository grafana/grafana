import {
  createARGResourcesResponse,
  createMockARGResourceGroupsResponse,
  createMockARGSubscriptionResponse,
} from '../__mocks__/argResourcePickerResponse';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import { AzureGraphResponse } from '../types';

import ResourcePickerData from './resourcePickerData';

const createResourcePickerData = (responses: AzureGraphResponse[]) => {
  const instanceSettings = createMockInstanceSetttings();
  const resourcePickerData = new ResourcePickerData(instanceSettings);

  const postResource = jest.fn();
  responses.forEach((res) => {
    postResource.mockResolvedValueOnce(res);
  });
  resourcePickerData.postResource = postResource;

  return { resourcePickerData, postResource };
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
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourceGroupsBySubscriptionId('123', 'metrics');

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [_, postBody] = firstCall;
      expect(postBody.query).toContain('wandisco.fusion/migrators');
    });
  });

  describe('getResourcesForResourceGroup', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourcesForResourceGroup('dev', 'logs');

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [path, postBody] = firstCall;
      expect(path).toEqual('resourcegraph/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01');
      expect(postBody.query).toContain('resources');
      expect(postBody.query).toContain('where id hasprefix "dev"');
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
        location: 'North Europe',
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
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourcesForResourceGroup('dev', 'metrics');

      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [_, postBody] = firstCall;
      expect(postBody.query).toContain('wandisco.fusion/migrators');
    });
  });

  describe('search', () => {
    it('makes requests for metrics searches', async () => {
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
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      const formattedResults = await resourcePickerData.search('vmname', 'metrics');
      expect(postResource).toBeCalledTimes(1);
      const firstCall = postResource.mock.calls[0];
      const [_, postBody] = firstCall;
      expect(postBody.query).not.toContain('union resourcecontainers');
      expect(postBody.query).toContain('where id contains "vmname"');

      expect(formattedResults[0]).toEqual({
        id: 'vmname',
        name: 'vmName',
        type: 'Resource',
        location: 'North Europe',
        resourceGroupName: 'rgName',
        typeLabel: 'Virtual machines',
        uri: '/subscriptions/subId/resourceGroups/rgName/providers/Microsoft.Compute/virtualMachines/vmname',
      });
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
        location: 'North Europe',
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
});
