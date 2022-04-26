import ResourcePicker from '../resourcePicker/resourcePickerData';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export default function createMockResourcePickerData(overrides?: DeepPartial<ResourcePicker>) {
  const _mockResourcePicker: DeepPartial<ResourcePicker> = {
    getSubscriptions: () => jest.fn().mockResolvedValue([]),
    getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue([]),
    getResourcesForResourceGroup: jest.fn().mockResolvedValue([]),
    getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
    ...overrides,
  };

  const mockDatasource = _mockResourcePicker as ResourcePicker;

  return jest.mocked(mockDatasource, true);
}
