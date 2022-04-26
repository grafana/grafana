import Datasource from '../datasource';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export default function createMockDatasource(overrides?: DeepPartial<Datasource>) {
  // We make this a partial so we get _some_ kind of type safety when making this, rather than
  // having it be any or casted immediately to Datasource
  const _mockDatasource: DeepPartial<Datasource> = {
    getVariables: jest.fn().mockReturnValue([]),

    azureMonitorDatasource: {
      isConfigured() {
        return true;
      },
      getSubscriptions: jest.fn().mockResolvedValueOnce([]),
      defaultSubscriptionId: 'subscriptionId',
    },

    getAzureLogAnalyticsWorkspaces: jest.fn().mockResolvedValueOnce([]),

    getResourceGroups: jest.fn().mockResolvedValueOnce([]),
    getMetricDefinitions: jest.fn().mockResolvedValueOnce([]),
    getResourceNames: jest.fn().mockResolvedValueOnce([]),
    getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
    getMetricNames: jest.fn().mockResolvedValueOnce([]),
    getMetricMetadata: jest.fn().mockResolvedValueOnce({
      primaryAggType: 'Average',
      supportedAggTypes: ['Average', 'Maximum', 'Minimum'],
      supportedTimeGrains: [],
      dimensions: [],
    }),

    azureLogAnalyticsDatasource: {
      getKustoSchema: () => Promise.resolve(),
      getDeprecatedDefaultWorkSpace: () => 'defaultWorkspaceId',
    },
    resourcePickerData: {
      getSubscriptions: () => jest.fn().mockResolvedValue([]),
      getResourceGroupsBySubscriptionId: jest.fn().mockResolvedValue([]),
      getResourcesForResourceGroup: jest.fn().mockResolvedValue([]),
      getResourceURIFromWorkspace: jest.fn().mockReturnValue(''),
    },
    ...overrides,
  };

  const mockDatasource = _mockDatasource as Datasource;

  return jest.mocked(mockDatasource, true);
}
