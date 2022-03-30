import {
  createARGResourcesResponse,
  createMockARGResourceGroupsResponse,
  createMockARGSubscriptionResponse,
} from '../__mocks__/argResourcePickerResponse';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import ResourcePickerData from './resourcePickerData';
import { AzureGraphResponse } from '../types';

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
        expect(err.message).toEqual('No subscriptions were found');
      }
    });
  });

  describe('getResourceGroupsBySubscriptionId', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createMockARGResourceGroupsResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourceGroupsBySubscriptionId('123');

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

      const resourceGroups = await resourcePickerData.getResourceGroupsBySubscriptionId('123');
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

      await resourcePickerData.getResourceGroupsBySubscriptionId('123');

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

      const resourceGroups = await resourcePickerData.getResourceGroupsBySubscriptionId('123');

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
        await resourcePickerData.getResourceGroupsBySubscriptionId('123');
        throw Error('expected getResourceGroupsBySubscriptionId to fail but it succeeded');
      } catch (err) {
        expect(err.message).toEqual('unable to fetch resource groups');
      }
    });
  });

  describe('getResourcesForResourceGroup', () => {
    it('makes 1 call to ARG with the correct path and query arguments', async () => {
      const mockResponse = createARGResourcesResponse();
      const { resourcePickerData, postResource } = createResourcePickerData([mockResponse]);
      await resourcePickerData.getResourcesForResourceGroup('dev');

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

      const resources = await resourcePickerData.getResourcesForResourceGroup('dev');

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
        await resourcePickerData.getResourcesForResourceGroup('dev');
        throw Error('expected getResourcesForResourceGroup to fail but it succeeded');
      } catch (err) {
        expect(err.message).toEqual('unable to fetch resource details');
      }
    });
  });
});
