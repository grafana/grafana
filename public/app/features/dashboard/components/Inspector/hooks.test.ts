import { type DataSourceApi, type PanelData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { getDataSourceWithErrorsAndNoticesInspector } from './hooks';

jest.mock('@grafana/runtime', () => ({
  getDataSourceSrv: jest.fn(),
}));

function mockDataSource(withInspector: boolean): DataSourceApi {
  return {
    components: withInspector ? { ErrorsAndNoticesInspector: () => null } : {},
  } as unknown as DataSourceApi;
}

function setDataSource(ds: DataSourceApi) {
  (getDataSourceSrv as jest.Mock).mockReturnValue({ get: jest.fn().mockResolvedValue(ds) });
}

function buildData(overrides: Partial<PanelData>): PanelData {
  return {
    series: [],
    request: { targets: [{ refId: 'A', datasource: { uid: 'abc' } }] },
    ...overrides,
  } as unknown as PanelData;
}

describe('getDataSourceWithErrorsAndNoticesInspector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDataSource(mockDataSource(true));
  });

  it('returns undefined when there is no data', async () => {
    expect(await getDataSourceWithErrorsAndNoticesInspector(undefined)).toBeUndefined();
  });

  it('returns undefined when there are no targets', async () => {
    const data = buildData({ request: { targets: [] } as unknown as PanelData['request'] });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeUndefined();
  });

  it('returns undefined when there are no errors or notices', async () => {
    const data = buildData({ series: [{ name: 'A', fields: [], length: 0 }] });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeUndefined();
  });

  it('returns the data source when there is a query error and it implements the inspector', async () => {
    const data = buildData({ error: { message: 'boom' } });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeDefined();
  });

  it('returns the data source when a frame has notices', async () => {
    const data = buildData({
      series: [{ name: 'A', fields: [], length: 0, meta: { notices: [{ severity: 'warning', text: 'x' }] } }],
    });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeDefined();
  });

  it('returns undefined when the data source does not implement the inspector', async () => {
    setDataSource(mockDataSource(false));
    const data = buildData({ errors: [{ message: 'boom' }] });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeUndefined();
  });
});
