import { renderHook } from '@testing-library/react';

import { type DataSourceInstanceSettings, type DataSourcePluginMeta } from '@grafana/data';
import { setDataSourceSrv } from '@grafana/runtime';
import { type DataSourceRef } from '@grafana/schema';

import { getMockedDatasourceSrv } from '../utils/mocks';

import { useDataSourceInstanceListItem } from './useDataSourceInstanceListItem';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  useDataSourceInstanceListItem: undefined,
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
const bravo = settings('ds-b', 'B');

describe('useDataSourceInstanceListItem', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setDataSourceSrv(mockDatasourceSrv);
  });

  it('should return the list item without a loading phase', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);

    const { result } = renderHook(() => useDataSourceInstanceListItem('ds-a'));

    expect(result.current).toEqual({
      isLoading: false,
      item: { uid: 'ds-a', name: 'A', type: 'loki', meta: { id: 'loki', name: 'Loki' } },
    });
  });

  it('should pass the ref through to the legacy lookup', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);
    const ref: DataSourceRef = { uid: 'ds-a', type: 'loki' };

    renderHook(() => useDataSourceInstanceListItem(ref));

    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith(ref);
  });

  it('should resolve the default data source when ref is undefined', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);

    const { result } = renderHook(() => useDataSourceInstanceListItem());

    expect(result.current.item?.uid).toBe('ds-a');
    expect(mockDatasourceSrv.getInstanceSettings).toHaveBeenCalledWith(undefined);
  });

  it('should return undefined without an error for an unknown ref', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(undefined);

    const { result } = renderHook(() => useDataSourceInstanceListItem('missing'));

    expect(result.current).toEqual({ isLoading: false, item: undefined });
  });

  it('should keep the same item reference across renders while the settings are unchanged', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);
    const { result, rerender } = renderHook(() => useDataSourceInstanceListItem('ds-a'));
    const firstItem = result.current.item;

    rerender();

    expect(result.current.item).toBe(firstItem);
  });

  it('should re-resolve when the ref changes', () => {
    mockDatasourceSrv.getInstanceSettings.mockImplementation((uid: string) => (uid === 'ds-a' ? alpha : bravo));
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstanceListItem(ref), {
      initialProps: { ref: 'ds-a' },
    });

    rerender({ ref: 'ds-b' });

    expect(result.current.item?.name).toBe('B');
  });

  it('should resolve a template variable to the data source it points to, with a stable reference', () => {
    mockDatasourceSrv.getInstanceSettings.mockImplementation((ref: string) =>
      ref === '$ds' ? { ...alpha, uid: '$ds', name: '$ds', rawRef: { type: 'loki', uid: 'ds-a' } } : alpha
    );
    const { result, rerender } = renderHook(() => useDataSourceInstanceListItem('$ds'));
    const firstItem = result.current.item;

    rerender();

    expect(firstItem).toMatchObject({ uid: 'ds-a', name: 'A' });
    expect(result.current.item).toBe(firstItem);
  });

  it('should pick up settings reloaded under the same ref on the next render', () => {
    mockDatasourceSrv.getInstanceSettings.mockReturnValue(alpha);
    const { result, rerender } = renderHook(() => useDataSourceInstanceListItem('ds-a'));

    mockDatasourceSrv.getInstanceSettings.mockReturnValue(settings('ds-a', 'A renamed'));
    rerender();

    expect(result.current.item?.name).toBe('A renamed');
  });
});
