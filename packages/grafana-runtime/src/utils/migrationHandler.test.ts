import { BackendSrv, BackendSrvRequest } from 'src/services';

import { DataQueryRequest, DataSourceInstanceSettings } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { config } from '../config';

import { DataSourceWithBackend } from './DataSourceWithBackend';
import { isMigrationHandler, migrateQuery, migrateRequest, MigrationHandler } from './migrationHandler';

let mockDatasourcePost = jest.fn();

interface MyQuery extends DataQuery {}

class MyDataSourceWithoutMigration extends DataSourceWithBackend<MyQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
  }
}

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

  describe('isMigrationHandler', () => {
    it('returns true for a datasource with backend migration', () => {
      const ds = createMockDatasource();
      expect(isMigrationHandler(ds)).toBe(true);
    });

    it('returns false for a datasource without backend migration', () => {
      const ds = new MyDataSourceWithoutMigration({} as DataSourceInstanceSettings<DataSourceJsonData>);
      expect(isMigrationHandler(ds)).toBe(false);
    });
  });

  describe('migrateQuery', () => {
    it('skips migration if the datasource does not support it', async () => {
      const ds = createMockDatasource();
      ds.hasBackendMigration = false;
      const query = { refId: 'A', datasource: { type: 'dummy' } };

      const result = await migrateQuery(ds, query);

      expect(query).toEqual(result);
      expect(mockDatasourcePost).not.toHaveBeenCalled();
    });

    it('skips migration if the query should not be migrated', async () => {
      const ds = createMockDatasource();
      ds.shouldMigrate = jest.fn().mockReturnValue(false);
      const query = { refId: 'A', datasource: { type: 'dummy' } };

      const result = await migrateQuery(ds, query);

      expect(query).toEqual(result);
      expect(mockDatasourcePost).not.toHaveBeenCalled();
    });

    it('check that migrateQuery works', async () => {
      const ds = createMockDatasource();

      const originalQuery = { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' };
      const migratedQuery = { refId: 'A', datasource: { type: 'dummy' }, foobar: 'barfoo' };
      mockDatasourcePost = jest.fn().mockImplementation((args: { url: string; data: unknown }) => {
        expect(args.url).toBe('/apis/dummy.datasource.grafana.app/v0alpha1/namespaces/default/queryconvert');
        expect(args.data).toMatchObject({ queries: [originalQuery] });
        return Promise.resolve({ queries: [{ JSON: migratedQuery }] });
      });

      const result = await migrateQuery(ds, originalQuery);

      expect(migratedQuery).toEqual(result);
    });
  });

  describe('migrateRequest', () => {
    it('skips migration if the datasource does not support it', async () => {
      const ds = createMockDatasource();
      ds.hasBackendMigration = false;
      const request = {
        targets: [{ refId: 'A', datasource: { type: 'dummy' } }],
      } as unknown as DataQueryRequest<MyQuery>;

      const result = await migrateRequest(ds, request);

      expect(request).toEqual(result);
      expect(mockDatasourcePost).not.toHaveBeenCalled();
    });

    it('skips migration if none of the queries should be migrated', async () => {
      const ds = createMockDatasource();
      ds.shouldMigrate = jest.fn().mockReturnValue(false);
      const request = {
        targets: [{ refId: 'A', datasource: { type: 'dummy' } }],
      } as unknown as DataQueryRequest<MyQuery>;

      const result = await migrateRequest(ds, request);

      expect(request).toEqual(result);
      expect(mockDatasourcePost).not.toHaveBeenCalled();
    });

    it('check that migrateRequest migrates a request', async () => {
      const ds = createMockDatasource();

      const originalRequest = {
        targets: [
          { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' },
          { refId: 'A', datasource: { type: 'dummy' }, bar: 'foo' },
        ],
      } as unknown as DataQueryRequest<MyQuery>;
      const migratedRequest = {
        targets: [
          { refId: 'A', datasource: { type: 'dummy' }, foobar: 'foobar' },
          { refId: 'A', datasource: { type: 'dummy' }, barfoo: 'barfoo' },
        ],
      };
      mockDatasourcePost = jest.fn().mockImplementation((args: { url: string; data: unknown }) => {
        expect(args.url).toBe('/apis/dummy.datasource.grafana.app/v0alpha1/namespaces/default/queryconvert');
        expect(args.data).toMatchObject({ queries: originalRequest.targets });
        return Promise.resolve({ queries: migratedRequest.targets.map((query) => ({ JSON: query })) });
      });

      const result = await migrateRequest(ds, originalRequest);

      expect(migratedRequest).toEqual(result);
    });
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

  mockDatasourcePost.mockReset();

  return new MyDataSource(settings);
}
