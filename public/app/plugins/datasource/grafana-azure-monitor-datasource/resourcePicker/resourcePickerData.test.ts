import {
  createARGResourcesResponse,
  createMockARGResourceGroupsResponse,
  createMockARGSubscriptionResponse,
} from '../__mocks__/argResourcePickerResponse';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
import { ResourceRowType } from '../components/ResourcePicker/types';
import ResourcePickerData from './resourcePickerData';

const instanceSettings = createMockInstanceSetttings();
const resourcePickerData = new ResourcePickerData(instanceSettings);
let postResource: jest.Mock;

describe('AzureMonitor resourcePickerData', () => {
  describe('getSubscriptions', () => {
    beforeEach(() => {
      postResource = jest.fn().mockResolvedValue(createMockARGSubscriptionResponse());
      resourcePickerData.postResource = postResource;
    });

    it('calls ARG API', async () => {
      await resourcePickerData.getSubscriptions();

      expect(postResource).toHaveBeenCalled();
      const argQuery = postResource.mock.calls[0][1].query;

      expect(argQuery).toContain(`where type == 'microsoft.resources/subscriptions'`);
    });

    describe('when there is more than one page', () => {
      beforeEach(() => {
        const response1 = {
          ...createMockARGSubscriptionResponse(),
          $skipToken: 'aaa',
        };
        const response2 = createMockARGSubscriptionResponse();
        postResource = jest.fn();
        postResource.mockResolvedValueOnce(response1);
        postResource.mockResolvedValueOnce(response2);
        resourcePickerData.postResource = postResource;
      });

      it('should requests additional pages', async () => {
        await resourcePickerData.getSubscriptions();
        expect(postResource).toHaveBeenCalledTimes(2);
      });

      it('should use the skipToken of the previous page', async () => {
        await resourcePickerData.getSubscriptions();
        const secondCall = postResource.mock.calls[1];
        expect(secondCall[1]).toMatchObject({ options: { $skipToken: 'aaa', resultFormat: 'objectArray' } });
      });
    });
  });

  describe('getResourcesForResourceGroup', () => {
    beforeEach(() => {
      postResource = jest.fn().mockResolvedValue(createMockARGResourceGroupsResponse());
      resourcePickerData.postResource = postResource;
    });

    it('calls ARG API', async () => {
      await resourcePickerData.getResourceGroupsBySubscriptionId('123');

      expect(postResource).toHaveBeenCalled();
      const argQuery = postResource.mock.calls[0][1].query;

      expect(argQuery).toContain(`| where subscriptionId == '123'`);
    });

    describe('when there is more than one page', () => {
      beforeEach(() => {
        const response1 = {
          ...createMockARGResourceGroupsResponse(),
          $skipToken: 'aaa',
        };
        const response2 = createMockARGResourceGroupsResponse();
        postResource = jest.fn();
        postResource.mockResolvedValueOnce(response1);
        postResource.mockResolvedValueOnce(response2);
        resourcePickerData.postResource = postResource;
      });

      it('should requests additional pages', async () => {
        await resourcePickerData.getResourceGroupsBySubscriptionId('123');
        expect(postResource).toHaveBeenCalledTimes(2);
      });

      it('should use the skipToken of the previous page', async () => {
        await resourcePickerData.getResourceGroupsBySubscriptionId('123');
        const secondCall = postResource.mock.calls[1];
        expect(secondCall[1]).toMatchObject({ options: { $skipToken: 'aaa', resultFormat: 'objectArray' } });
      });
    });
  });

  describe('getResourcesForResourceGroup', () => {
    const resourceRow = {
      id: '/subscriptions/def-456/resourceGroups/dev',
      name: 'Dev',
      type: ResourceRowType.ResourceGroup,
      typeLabel: 'Resource group',
    };

    beforeEach(() => {
      postResource = jest.fn().mockResolvedValue(createARGResourcesResponse());
      resourcePickerData.postResource = postResource;
    });

    it('requests resources for the specified resource row', async () => {
      await resourcePickerData.getResourcesForResourceGroup(resourceRow.id);

      expect(postResource).toHaveBeenCalled();
      const argQuery = postResource.mock.calls[0][1].query;

      expect(argQuery).toContain(resourceRow.id);
    });

    it('returns formatted resources', async () => {
      const results = await resourcePickerData.getResourcesForResourceGroup(resourceRow.id);

      expect(results.map((v) => v.id)).toEqual([
        '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
        '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
        '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
        '/subscriptions/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
      ]);

      results.forEach((v) => expect(v.type).toEqual(ResourceRowType.Resource));
    });
  });
});
