import { render, screen } from '@testing-library/react';
import { BackendSrv, BackendSrvRequest, FetchResponse } from 'src/services';

import { DataSourceInstanceSettings, QueryEditorProps } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { config } from '../config';

import { DataSourceWithBackend } from '../utils/DataSourceWithBackend';
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
const mockDatasourceRequest = jest.fn<Promise<FetchResponse>, BackendSrvRequest[]>();

interface MyQuery extends DataQuery {}

class MyDataSource extends DataSourceWithBackend<MyQuery, DataSourceJsonData> {
  constructor(instanceSettings: DataSourceInstanceSettings<DataSourceJsonData>) {
    super(instanceSettings);
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

  mockDatasourceRequest.mockReset();
  mockDatasourceRequest.mockReturnValue(Promise.resolve({} as FetchResponse));

  const ds = new MyDataSource(settings);
  return { ds, mock: mockDatasourceRequest.mock };
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
    const { ds } = createMockDatasource();
    const originalQuery = { refId: 'A', datasource: { type: 'dummy' }, foo: 'bar' };
    const migratedQuery = { refId: 'A', datasource: { type: 'dummy' }, foobar: 'barfoo' };

    mockDatasourcePost = jest.fn().mockImplementation((args: { url: string; data: unknown }) => {
      expect(args.url).toBe('/apis/dummy.datasource.grafana.app/v0alpha1/namespaces/default/queryconvert');
      expect(args.data).toMatchObject({ queries: [originalQuery] });
      return Promise.resolve({ queries: [{ JSON: migratedQuery }] });
    });

    render(<WithMigration datasource={ds} query={originalQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />);
    expect(screen.findByText(JSON.stringify(migratedQuery))).toBeTruthy();
  });
});
