import ResourcePickerData from './resourcePickerData';
import {
  createMockARGResourceContainersResponse,
  createARGResourcesResponse,
} from '../__mocks__/argResourcePickerResponse';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';

const instanceSettings = createMockInstanceSetttings();
const resourcePickerData = new ResourcePickerData(instanceSettings);
let postResource: jest.Mock;

describe('AzureMonitor resourcePickerData', () => {
  describe('getResourcePickerData', () => {
    beforeEach(() => {
      postResource = jest.fn().mockResolvedValue(createMockARGResourceContainersResponse());
      resourcePickerData.postResource = postResource;
    });

    it('calls ARG API', async () => {
      await resourcePickerData.getResourcePickerData();

      expect(postResource).toHaveBeenCalled();
      const argQuery = postResource.mock.calls[0][1].query;

      expect(argQuery).toContain(`where type == 'microsoft.resources/subscriptions'`);
      expect(argQuery).toContain(`where type == 'microsoft.resources/subscriptions/resourcegroups'`);
    });

    it('returns only subscriptions at the top level', async () => {
      const results = await resourcePickerData.getResourcePickerData();

      expect(results.map((v) => v.id)).toEqual(['/subscriptions/abc-123', '/subscription/def-456']);
    });

    it('nests resource groups under their subscriptions', async () => {
      const results = await resourcePickerData.getResourcePickerData();

      expect(results[0].children?.map((v) => v.id)).toEqual([
        '/subscriptions/abc-123/resourceGroups/prod',
        '/subscriptions/abc-123/resourceGroups/pre-prod',
      ]);

      expect(results[1].children?.map((v) => v.id)).toEqual([
        '/subscription/def-456/resourceGroups/dev',
        '/subscription/def-456/resourceGroups/test',
        '/subscription/def-456/resourceGroups/qa',
      ]);
    });

    describe('when there is more than one page', () => {
      beforeEach(() => {
        const response1 = {
          ...createMockARGResourceContainersResponse(),
          $skipToken: 'aaa',
        };
        const response2 = createMockARGResourceContainersResponse();
        postResource = jest.fn();
        postResource.mockResolvedValueOnce(response1);
        postResource.mockResolvedValueOnce(response2);
        resourcePickerData.postResource = postResource;
      });

      it('should requests additional pages', async () => {
        await resourcePickerData.getResourcePickerData();
        expect(postResource).toHaveBeenCalledTimes(2);
      });

      it('should use the skipToken of the previous page', async () => {
        await resourcePickerData.getResourcePickerData();
        const secondCall = postResource.mock.calls[1];
        expect(secondCall[1]).toMatchObject({ options: { $skipToken: 'aaa', resultFormat: 'objectArray' } });
      });

      it('should combine responses', async () => {
        const results = await resourcePickerData.getResourcePickerData();
        expect(results[0].children?.map((v) => v.id)).toEqual([
          '/subscriptions/abc-123/resourceGroups/prod',
          '/subscriptions/abc-123/resourceGroups/pre-prod',
          // second page
          '/subscriptions/abc-123/resourceGroups/prod',
          '/subscriptions/abc-123/resourceGroups/pre-prod',
        ]);

        expect(results[1].children?.map((v) => v.id)).toEqual([
          '/subscription/def-456/resourceGroups/dev',
          '/subscription/def-456/resourceGroups/test',
          '/subscription/def-456/resourceGroups/qa',
          // second page
          '/subscription/def-456/resourceGroups/dev',
          '/subscription/def-456/resourceGroups/test',
          '/subscription/def-456/resourceGroups/qa',
        ]);
      });
    });
  });

  describe('getResourcesForResourceGroup', () => {
    const resourceRow = {
      id: '/subscription/def-456/resourceGroups/dev',
      name: 'Dev',
      type: ResourceRowType.ResourceGroup,
      typeLabel: 'Resource group',
    };

    beforeEach(() => {
      postResource = jest.fn().mockResolvedValue(createARGResourcesResponse());
      resourcePickerData.postResource = postResource;
    });

    it('requests resources for the specified resource row', async () => {
      await resourcePickerData.getResourcesForResourceGroup(resourceRow);

      expect(postResource).toHaveBeenCalled();
      const argQuery = postResource.mock.calls[0][1].query;

      expect(argQuery).toContain(resourceRow.id);
    });

    it('returns formatted resources', async () => {
      const results = await resourcePickerData.getResourcesForResourceGroup(resourceRow);

      expect(results.map((v) => v.id)).toEqual([
        '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
        '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
        '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
        '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
      ]);

      results.forEach((v) => expect(v.type).toEqual(ResourceRowType.Resource));
    });
  });
});
