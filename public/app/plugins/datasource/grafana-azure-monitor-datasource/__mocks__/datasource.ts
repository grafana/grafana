import Datasource from '../datasource';

type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

export default function createMockDatasource() {
  // We make this a partial so we get _some_ kind of type safety when making this, rather than
  // having it be any or casted immediately to Datasource
  const _mockDatasource: DeepPartial<Datasource> = {
    azureMonitorDatasource: {
      isConfigured() {
        return true;
      },
      getSubscriptions: jest.fn().mockResolvedValueOnce([]),
    },

    getResourceGroups: jest.fn().mockResolvedValueOnce([]),
    getMetricDefinitions: jest.fn().mockResolvedValueOnce([]),
    getResourceNames: jest.fn().mockResolvedValueOnce([]),
    getMetricNamespaces: jest.fn().mockResolvedValueOnce([]),
    getMetricNames: jest.fn().mockResolvedValueOnce([]),
    getMetricMetadata: jest.fn().mockResolvedValueOnce({
      primaryAggType: 'average',
      supportedAggTypes: [],
      supportedTimeGrains: [],
      dimensions: [],
    }),
  };

  const mockDatasource = _mockDatasource as Datasource;

  return mockDatasource;
}
