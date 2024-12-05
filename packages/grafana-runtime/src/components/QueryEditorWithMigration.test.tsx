import { render, screen, waitFor } from '@testing-library/react';

import { DataSourceInstanceSettings, QueryEditorProps } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { config } from '../config';
import { BackendSrv, BackendSrvRequest } from '../services';
import { DataSourceWithBackend } from '../utils/DataSourceWithBackend';
import { MigrationHandler } from '../utils/migrationHandler';

import { QueryEditorWithMigration } from './QueryEditorWithMigration';

const backendSrv = {
  post<T = unknown>(url: string, data?: unknown, options?: Partial<BackendSrvRequest>): Promise<T> {
    return mockDatasourcePost({ url, data, ...options });
  },
} as unknown as BackendSrv;

jest.mock('../services', () => ({
  ...jest.requireActual('../services'),
  getBackendSrv: () => backendSrv,
}));

let mockDatasourcePost = jest.fn();

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

type Props = QueryEditorProps<MyDataSource, MyQuery, DataSourceJsonData>;

function QueryEditor(props: Props) {
  return <div>{JSON.stringify(props.query)}</div>;
}

function createMockDatasource(otherSettings?: Partial<DataSourceInstanceSettings<DataSourceJsonData>>) {
  const settings = {
    name: 'test',
    id: 1234,
    uid: 'abc',
    type: 'dummy',
    jsonData: {},
    ...otherSettings,
  } as DataSourceInstanceSettings<DataSourceJsonData>;

  return new MyDataSource(settings);
}

describe('QueryEditorWithMigration', () => {
  const originalFeatureToggles = config.featureToggles;
  beforeEach(() => {
    config.featureToggles = { ...originalFeatureToggles, grafanaAPIServerWithExperimentalAPIs: true };
  });
  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('should migrate a query', async () => {
    const WithMigration = QueryEditorWithMigration(QueryEditor);
    const ds = createMockDatasource();
    const originalQuery = { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' };
    const migratedQuery = { refId: 'A', datasource: { type: 'dummy' }, foobar: 'barfoo' };

    mockDatasourcePost = jest.fn().mockImplementation((args: { url: string; data: unknown }) => {
      expect(args.url).toBe('/apis/dummy.datasource.grafana.app/v0alpha1/namespaces/default/queryconvert');
      expect(args.data).toMatchObject({ queries: [originalQuery] });
      return Promise.resolve({ queries: [{ JSON: migratedQuery }] });
    });

    render(<WithMigration datasource={ds} query={originalQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />);

    await waitFor(() => {
      // Check that migratedQuery is rendered
      expect(screen.getByText(JSON.stringify(migratedQuery))).toBeInTheDocument();
    });
  });

  it('should render a Skeleton while migrating', async () => {
    const WithMigration = QueryEditorWithMigration(QueryEditor);
    const ds = createMockDatasource();
    const originalQuery = { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' };

    mockDatasourcePost = jest.fn().mockImplementation(async (args: { url: string; data: unknown }) => {
      await waitFor(() => {}, { timeout: 5000 });
      return Promise.resolve({ queries: [{ JSON: originalQuery }] });
    });

    render(<WithMigration datasource={ds} query={originalQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />);
    expect(screen.getByTestId('react-loading-skeleton-testid')).toBeInTheDocument();
  });
});
