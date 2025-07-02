import createMockDatasource from '../../mocks/datasource';
import { createMockInstanceSetttings } from '../../mocks/instanceSettings';
import {
  createMockSubscriptions,
  createMockResourceGroupsBySubscription,
  mockResourcesByResourceGroup,
} from '../../mocks/resourcePickerRows';
import ResourcePickerData from '../../resourcePicker/resourcePickerData';

export function createMockResourcePickerData() {
  const mockDatasource = createMockDatasource();
  const mockResourcePicker = new ResourcePickerData(
    createMockInstanceSetttings(),
    mockDatasource.azureMonitorDatasource,
    mockDatasource.azureResourceGraphDatasource
  );

  mockResourcePicker.getSubscriptions = jest.fn().mockResolvedValue(createMockSubscriptions());
  mockResourcePicker.getResourceGroupsBySubscriptionId = jest
    .fn()
    .mockResolvedValue(createMockResourceGroupsBySubscription());
  mockResourcePicker.getResourcesForResourceGroup = jest.fn().mockResolvedValue(mockResourcesByResourceGroup());
  mockResourcePicker.getResourceURIFromWorkspace = jest.fn().mockReturnValue('');
  mockResourcePicker.getResourceURIDisplayProperties = jest.fn().mockResolvedValue({});
  return mockResourcePicker;
}
