import { of } from 'rxjs';

import { createFetchResponse } from 'test/helpers/createFetchResponse';
import { backendSrv } from 'app/core/services/backend_srv';

import ResourcePickerData from './resourcePickerData';
import {
  createMockARGResourceContainersResponse,
  createARGResourcesResponse,
} from '../__mocks__/argResourcePickerResponse';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';

jest.mock('@grafana/runtime', () => ({
  ...((jest.requireActual('@grafana/runtime') as unknown) as object),
  getBackendSrv: () => backendSrv,
}));

const instanceSettings = createMockInstanceSetttings();

describe('AzureMonitor resourcePickerData', () => {
  describe('getResourcePickerData', () => {
    let fetchMock: jest.SpyInstance;

    beforeEach(() => {
      fetchMock = jest.spyOn(backendSrv, 'fetch');
      fetchMock.mockImplementation(() => {
        const data = createMockARGResourceContainersResponse();
        return of(createFetchResponse(data));
      });
    });

    afterEach(() => fetchMock.mockReset());

    it('calls ARG API', async () => {
      const resourcePickerData = new ResourcePickerData(instanceSettings);
      await resourcePickerData.getResourcePickerData();

      expect(fetchMock).toHaveBeenCalled();
      const argQuery = fetchMock.mock.calls[0][0].data.query;

      expect(argQuery).toContain(`where type == 'microsoft.resources/subscriptions'`);
      expect(argQuery).toContain(`where type == 'microsoft.resources/subscriptions/resourcegroups'`);
    });

    it('returns only subscriptions at the top level', async () => {
      const resourcePickerData = new ResourcePickerData(instanceSettings);
      const results = await resourcePickerData.getResourcePickerData();

      expect(results.map((v) => v.id)).toEqual(['/subscriptions/abc-123', '/subscription/def-456']);
    });

    it('nests resource groups under their subscriptions', async () => {
      const resourcePickerData = new ResourcePickerData(instanceSettings);
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
  });

  describe('getResourcesForResourceGroup', () => {
    let fetchMock: jest.SpyInstance;

    const resourceRow = {
      id: '/subscription/def-456/resourceGroups/dev',
      name: 'Dev',
      type: ResourceRowType.ResourceGroup,
      typeLabel: 'Resource group',
    };

    beforeEach(() => {
      fetchMock = jest.spyOn(backendSrv, 'fetch');
      fetchMock.mockImplementation(() => {
        const data = createARGResourcesResponse();
        return of(createFetchResponse(data));
      });
    });

    afterEach(() => fetchMock.mockReset());

    it('requests resources for the specified resource row', async () => {
      const resourcePickerData = new ResourcePickerData(instanceSettings);
      await resourcePickerData.getResourcesForResourceGroup(resourceRow);

      expect(fetchMock).toHaveBeenCalled();
      const argQuery = fetchMock.mock.calls[0][0].data.query;

      expect(argQuery).toContain(resourceRow.id);
    });

    it('returns formatted resources', async () => {
      const resourcePickerData = new ResourcePickerData(instanceSettings);
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
