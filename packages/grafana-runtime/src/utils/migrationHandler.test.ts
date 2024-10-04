import { BackendSrv, BackendSrvRequest, FetchResponse } from 'src/services';

import { DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { config } from '../config';

import { DataSourceWithBackend } from './DataSourceWithBackend';
import { migrateQuery, MigrationHandler } from './migrationHandler';

let mockDatasourcePost = jest.fn();
const mockDatasourceRequest = jest.fn<Promise<FetchResponse>, BackendSrvRequest[]>();

interface MyQuery extends DataQuery {}

class MyDataSource extends DataSourceWithBackend<MyQuery, DataSourceJsonData> implements MigrationHandler {
  hasBackendMigration: boolean;
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
    this.hasBackendMigration = true;
  }

  shouldMigrate(query: DataQuery): boolean {
    return true;
  }
}

const backendSrv = {
  post<T = unknown>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T> {
    return mockDatasourcePost({ url, data, ...options });
  },
} as unknown as BackendSrv;

jest.mock('../services', () => ({
  ...jest.requireActual('../services'),
  getBackendSrv: () => backendSrv,
}));

describe('query migration', () => {
  // Configure config.featureToggles.grafanaAPIServerWithExperimentalAPIs
  const originalFeatureToggles = config.featureToggles;
  beforeEach(() => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAPIServerWithExperimentalAPIs: true };
  });
  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  test('check that migrateRequest migrates a request', async () => {
    const { ds } = createMockDatasource({
      apiVersion: 'v0alpha1',
    });

    const originalQuery = { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' };
    const migratedQuery = { refId: 'A', datasource: { type: 'dummy' }, foobar: 'barfoo' };
    mockDatasourcePost = jest.fn().mockImplementation((args: { url: string; data: unknown }) => {
      expect(args.url).toBe('/apis/dummy.datasource.grafana.app/v0alpha1/namespaces/default/queryconvert');
      expect(args.data).toMatchObject({ queries: [originalQuery] });
      return Promise.resolve({ queries: [{ JSON: migratedQuery }] });
    });

    const result = await migrateQuery(ds, originalQuery);

    expect(migratedQuery).toBe(result);
  });
});

function createMockDatasource(otherSettings?: Partial<DataSourceInstanceSettings<DataSourceJsonData>>) {
  const settings = {
    name: 'test',
    id: 1234,
    uid: 'abc',
    type: 'dummy',
    jsonData: {},
    ...otherSettings,
  } as DataSourceInstanceSettings<DataSourceJsonData>;

  mockDatasourceRequest.mockReset();
  mockDatasourceRequest.mockReturnValue(Promise.resolve({} as FetchResponse));

  const ds = new MyDataSource(settings);
  return { ds, mock: mockDatasourceRequest.mock };
}
