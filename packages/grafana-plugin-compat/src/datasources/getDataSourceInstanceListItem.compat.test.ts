import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { setDataSourceSrv, type DataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { getDataSourceInstanceListItem } from './getDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceListItem: undefined,
}));

const mockDatasourceSrv = getMockedDatasourceSrv();

function settings(uid: string, name: string): DataSourceInstanceSettings {
  return {
    uid,
    name,
    type: 'loki',
    meta: { id: 'loki', name: 'Loki' } as DataSourcePluginMeta,
    jsonData: { secret: 'not part of a list item' },
    url: '/api/datasources/proxy/uid/' + uid,
    access: 'proxy',
    isDefault: false,
  } as unknown as DataSourceInstanceSettings;
}

const alpha = settings('ds-a', 'A');

describe('getDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should return only the list item fields', async () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);

    const result = await getDataSourceInstanceListItem('ds-a');

    expect(result).toStrictEqual({ uid: 'ds-a', name: 'A', type: 'loki', meta: { id: 'loki', name: 'Loki' } });
  });

  it('should pass the ref and scoped vars through to the legacy lookup', async () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);
    const ref: DataSourceRef = { uid: 'ds-a', type: 'loki' };
    const scopedVars = { var: { text: 'some-var', value: 0 } };

    await getDataSourceInstanceListItem(ref, scopedVars);

    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith(ref, scopedVars);
  });

  it('should resolve the default data source when ref is undefined', async () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);

    const result = await getDataSourceInstanceListItem();

    expect(result?.uid).toBe('ds-a');
    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should resolve undefined for an unknown ref', async () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(undefined);

    await expect(getDataSourceInstanceListItem('missing')).resolves.toBeUndefined();
  });

  it('should resolve a template variable to the data source it points to', async () => {
    mockDatasourceSrv.getInstanceSettings.mockImplementation((ref: string) =>
      ref === '$ds' ? { ...alpha, uid: '$ds', name: '$ds', rawRef: { type: 'loki', uid: 'ds-a' } } : alpha
    );

    const result = await getDataSourceInstanceListItem('$ds');

    expect(result).toMatchObject({ uid: 'ds-a', name: 'A' });
  });

  it('should reject when getDataSourceSrv is not setup', async () => {
    setDataSourceSrv(undefined as unknown as DataSourceSrv);

    await expect(getDataSourceInstanceListItem('ds-a')).rejects.toThrow();
  });
});
