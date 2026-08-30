import { type DataSourceApi, type PanelData } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { getDataSourceWithErrorsAndNoticesInspector, hasErrorsOrNotices } from './hooks';

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

describe('hasErrorsOrNotices', () => {
  it('returns false when there is no data', () => {
    expect(hasErrorsOrNotices(undefined)).toBe(false);
  });

  it('returns false when there are no errors or notices', () => {
    expect(hasErrorsOrNotices(buildData({ series: [{ name: 'A', fields: [], length: 0 }] }))).toBe(false);
  });

  it('returns true when there is a single query error', () => {
    expect(hasErrorsOrNotices(buildData({ error: { message: 'boom' } }))).toBe(true);
  });

  it('returns true when there are multiple query errors', () => {
    expect(hasErrorsOrNotices(buildData({ errors: [{ message: 'boom' }] }))).toBe(true);
  });

  it('returns true when a frame has notices', () => {
    const data = buildData({
      series: [{ name: 'A', fields: [], length: 0, meta: { notices: [{ severity: 'warning', text: 'x' }] } }],
    });
    expect(hasErrorsOrNotices(data)).toBe(true);
  });
});

describe('getDataSourceWithErrorsAndNoticesInspector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDataSource(mockDataSource(true));
  });

  it('returns undefined when there are no targets', async () => {
    const data = buildData({ request: { targets: [] } as unknown as PanelData['request'] });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeUndefined();
  });

  it('returns the data source when a single data source implements the inspector', async () => {
    expect(await getDataSourceWithErrorsAndNoticesInspector(buildData({}))).toBeDefined();
  });

  it('returns undefined when the data source does not implement the inspector', async () => {
    setDataSource(mockDataSource(false));
    expect(await getDataSourceWithErrorsAndNoticesInspector(buildData({}))).toBeUndefined();
  });

  it('returns undefined for mixed data sources even if the first implements the inspector', async () => {
    const data = buildData({
      request: {
        targets: [
          { refId: 'A', datasource: { uid: 'abc' } },
          { refId: 'B', datasource: { uid: 'def' } },
        ],
      } as unknown as PanelData['request'],
    });
    expect(await getDataSourceWithErrorsAndNoticesInspector(data)).toBeUndefined();
  });
});
