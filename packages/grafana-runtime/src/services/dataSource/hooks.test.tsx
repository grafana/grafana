import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceListItem, type DataSourceInstanceSettings } from '@grafana/data';

import { RuntimeDataSource } from '../RuntimeDataSource';
import { setBackendSrv } from '../backendSrv';
import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setDatasourcePluginMetas } from '../pluginMeta/datasources';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests as resetPlugin,
  registerRuntimeDataSourceInstance,
  setDataSourcePluginImporter,
} from './dataSource';
import {
  useDataSourceInstance,
  useDataSourceInstanceList,
  useDataSourceInstanceListItem,
  useDataSourceInstanceSettings,
  useDefaultDataSourceInstanceListItem,
  useHasDataSourceInstance,
} from './hooks';
import { _resetForTests as resetPluginCache } from './pluginCache';
import {
  reloadDataSourceInstanceSettings,
  setDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
} from './settings';

function ds(overrides: Partial<DataSourceInstanceSettings>): DataSourceInstanceSettings {
  return {
    id: 1,
    uid: 'uid',
    name: 'name',
    type: 'test-db',
    access: 'direct',
    jsonData: {},
    readOnly: false,
    meta: {
      id: 'test-db',
      name: 'Test DB',
      type: 'datasource',
      module: '',
      baseUrl: '',
      info: {
        author: { name: '' },
        description: '',
        links: [],
        logos: { small: '', large: '' },
        screenshots: [],
        updated: '',
        version: '',
      },
      metrics: true,
    },
    ...overrides,
  } as DataSourceInstanceSettings;
}

const fixtures: Record<string, DataSourceInstanceSettings> = {
  Alpha: ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', type: 'test-db' }),
  Bravo: ds({ id: 2, uid: 'uid-bravo', name: 'Bravo', type: 'test-db', isDefault: true }),
};

const templateSrv = {
  getVariables: () => [],
  replace: (value?: string) => value ?? '',
} as unknown as TemplateSrv;

const backendGet = jest.fn();

class TestRuntime extends RuntimeDataSource {
  query() {
    return Promise.resolve({ data: [] });
  }
}

beforeAll(() => {
  setTemplateSrv(templateSrv);
  setBackendSrv({
    get: backendGet,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

// Distinguishable from the copy embedded on the instance settings, so the list-item hook's
// assertions prove which cache answered.
const testDbPluginMeta = { ...ds({}).meta, name: 'Test DB (plugin meta)' };

beforeEach(() => {
  resetPlugin();
  resetPluginCache();
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
  setDataSourceInstanceSettings(fixtures, 'Bravo');
  setDatasourcePluginMetas({ 'test-db': testDbPluginMeta });
  backendGet.mockReset().mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
});

describe('useDataSourceInstanceSettings', () => {
  it('starts loading then resolves to data', async () => {
    const { result } = renderHook(() => useDataSourceInstanceSettings('uid-alpha'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.settings?.name).toBe('Alpha');
    expect(result.current.error).toBeUndefined();
  });

  it('refetches when the ref changes', async () => {
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstanceSettings(ref), {
      initialProps: { ref: 'uid-alpha' },
    });

    await waitFor(() => expect(result.current.settings?.name).toBe('Alpha'));

    rerender({ ref: 'uid-bravo' });
    await waitFor(() => expect(result.current.settings?.name).toBe('Bravo'));
  });

  it('refetches with the same ref when the cache is reloaded', async () => {
    const { result } = renderHook(() => useDataSourceInstanceSettings('uid-alpha'));
    await waitFor(() => expect(result.current.settings?.name).toBe('Alpha'));

    backendGet.mockResolvedValue({
      datasources: { Renamed: ds({ id: 1, uid: 'uid-alpha', name: 'Renamed', type: 'test-db' }) },
      defaultDatasource: 'Renamed',
    });
    await act(() => reloadDataSourceInstanceSettings());

    await waitFor(() => expect(result.current.settings?.name).toBe('Renamed'));
  });
});

describe('useDataSourceInstanceListItem', () => {
  it('starts loading then resolves to the list item', async () => {
    const { result } = renderHook(() => useDataSourceInstanceListItem('uid-alpha'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item?.name).toBe('Alpha');
    expect(result.current.item?.type).toBe('test-db');
    expect(result.current.item?.meta.name).toBe('Test DB (plugin meta)');
    expect(result.current.error).toBeUndefined();
  });

  it('resolves to undefined without an error for an unknown ref', async () => {
    const { result } = renderHook(() => useDataSourceInstanceListItem('nonexistent'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item).toBeUndefined();
    expect(result.current.error).toBeUndefined();
  });

  it('refetches when the ref changes', async () => {
    const { result, rerender } = renderHook(({ ref }) => useDataSourceInstanceListItem(ref), {
      initialProps: { ref: 'uid-alpha' },
    });

    await waitFor(() => expect(result.current.item?.name).toBe('Alpha'));

    rerender({ ref: 'uid-bravo' });
    await waitFor(() => expect(result.current.item?.name).toBe('Bravo'));
  });

  it('refetches with the same ref when the cache is reloaded', async () => {
    const { result } = renderHook(() => useDataSourceInstanceListItem('uid-alpha'));
    await waitFor(() => expect(result.current.item?.name).toBe('Alpha'));

    backendGet.mockResolvedValue({
      datasources: { Renamed: ds({ id: 1, uid: 'uid-alpha', name: 'Renamed', type: 'test-db' }) },
      defaultDatasource: 'Renamed',
    });
    await act(() => reloadDataSourceInstanceSettings());

    await waitFor(() => expect(result.current.item?.name).toBe('Renamed'));
  });

  it('refetches when the legacy service synchronizes the cache', async () => {
    const { result } = renderHook(() => useDataSourceInstanceListItem('uid-alpha'));
    await waitFor(() => expect(result.current.item?.name).toBe('Alpha'));

    act(() => {
      syncDataSourceInstanceSettings({
        datasources: { Synced: ds({ id: 1, uid: 'uid-alpha', name: 'Synced', type: 'test-db' }) },
        defaultDatasource: 'Synced',
      });
    });

    await waitFor(() => expect(result.current.item?.name).toBe('Synced'));
  });

  it('resolves a runtime data source registered after the hook mounted', async () => {
    const { result } = renderHook(() => useDataSourceInstanceListItem('runtime-uid'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item).toBeUndefined();

    const runtime = new TestRuntime('runtime-db', 'runtime-uid');
    act(() => {
      registerRuntimeDataSourceInstance({ dataSource: runtime });
    });

    await waitFor(() => expect(result.current.item?.name).toBe('RuntimeDataSource-runtime-db'));
  });
});

describe('useDataSourceInstanceList', () => {
  it('populates items', async () => {
    const { result } = renderHook(() => useDataSourceInstanceList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it('does not re-fetch when the same filter function reference is re-rendered', async () => {
    const stableFilter = (x: DataSourceInstanceListItem) => Boolean(x.meta.metrics);
    const { result, rerender } = renderHook(({ filter }) => useDataSourceInstanceList({ filter }), {
      initialProps: { filter: stableFilter },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const itemsAfterFirstRender = result.current.items;

    rerender({ filter: stableFilter });
    await act(async () => {});

    // Same reference — no new fetch cycle, items reference is unchanged.
    expect(result.current.isLoading).toBe(false);
    expect(result.current.items).toBe(itemsAfterFirstRender);
  });

  it('re-fetches and updates items when the filter function reference changes', async () => {
    const filterA = (x: DataSourceInstanceListItem) => x.name === 'Alpha';
    const filterB = (x: DataSourceInstanceListItem) => x.name === 'Bravo';

    const { result, rerender } = renderHook(({ filter }) => useDataSourceInstanceList({ filter }), {
      initialProps: { filter: filterA },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.every((x) => x.name === 'Alpha')).toBe(true);

    rerender({ filter: filterB });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.every((x) => x.name === 'Bravo')).toBe(true);
  });

  it('updates the list when the cache is reloaded', async () => {
    const { result } = renderHook(() => useDataSourceInstanceList());
    await waitFor(() => expect(result.current.items.map((item) => item.name)).toEqual(['Alpha', 'Bravo']));

    backendGet.mockResolvedValue({
      datasources: { Charlie: ds({ id: 3, uid: 'uid-charlie', name: 'Charlie', type: 'test-db' }) },
      defaultDatasource: 'Charlie',
    });
    await act(() => reloadDataSourceInstanceSettings());

    await waitFor(() => expect(result.current.items.map((item) => item.name)).toEqual(['Charlie']));
  });
});

describe('useDataSourceInstance', () => {
  it('starts loading then resolves to a plugin instance', async () => {
    const instance = { name: 'mock-ds' };
    setDataSourcePluginImporter(
      jest.fn().mockResolvedValue({ DataSourceClass: jest.fn().mockReturnValue(instance), components: {} })
    );

    const { result } = renderHook(() => useDataSourceInstance('uid-alpha'));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.dataSource).toBeTruthy();
    expect(result.current.error).toBeUndefined();
  });

  it('reports errors when lookup fails', async () => {
    const { result } = renderHook(() => useDataSourceInstance('missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('rebuilds the plugin instance when the cache is reloaded', async () => {
    const initial = ds({ id: 4, uid: 'refresh-uid', name: 'Initial', type: 'test-db' });
    setDataSourceInstanceSettings({ Initial: initial }, 'Initial');
    const DataSourceClass = jest.fn().mockImplementation(() => ({}));
    setDataSourcePluginImporter(jest.fn().mockResolvedValue({ DataSourceClass, components: {} }));

    const { result } = renderHook(() => useDataSourceInstance('refresh-uid'));
    await waitFor(() => expect(result.current.dataSource?.name).toBe('Initial'));

    backendGet.mockResolvedValue({
      datasources: { Refreshed: ds({ id: 4, uid: 'refresh-uid', name: 'Refreshed', type: 'test-db' }) },
      defaultDatasource: 'Refreshed',
    });
    await act(() => reloadDataSourceInstanceSettings());

    await waitFor(() => expect(result.current.dataSource?.name).toBe('Refreshed'));
    expect(DataSourceClass).toHaveBeenCalledTimes(2);
  });
});

describe('useDefaultDataSourceInstanceListItem', () => {
  const alpha = {
    uid: 'uid-alpha',
    type: 'test-db',
    name: 'Alpha',
    meta: {},
    isDefault: false,
  } as DataSourceInstanceListItem;
  const bravo = {
    uid: 'uid-bravo',
    type: 'test-db',
    name: 'Bravo',
    meta: {},
    isDefault: true,
  } as DataSourceInstanceListItem;

  it('starts loading then resolves to the flagged item', async () => {
    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha, bravo]));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item?.name).toBe('Bravo');
    expect(result.current.error).toBeUndefined();
  });

  it('resolves to undefined when no item is flagged', async () => {
    const { result } = renderHook(() => useDefaultDataSourceInstanceListItem([alpha]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.item).toBeUndefined();
  });

  it('does not re-resolve when an equivalent inline array is re-rendered', async () => {
    const { result, rerender } = renderHook(() => useDefaultDataSourceInstanceListItem([{ ...alpha }, { ...bravo }]));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const itemAfterFirstRender = result.current.item;

    rerender();
    await act(async () => {});

    expect(result.current.isLoading).toBe(false);
    expect(result.current.item).toBe(itemAfterFirstRender);
  });

  it('re-resolves when the flag moves to another item', async () => {
    const { result, rerender } = renderHook(({ items }) => useDefaultDataSourceInstanceListItem(items), {
      initialProps: { items: [alpha, bravo] },
    });

    await waitFor(() => expect(result.current.item?.name).toBe('Bravo'));

    rerender({
      items: [
        { ...alpha, isDefault: true },
        { ...bravo, isDefault: false },
      ],
    });
    await waitFor(() => expect(result.current.item?.name).toBe('Alpha'));
  });
});

describe('useHasDataSourceInstance', () => {
  it('starts loading then resolves to true for an existing type', async () => {
    const { result } = renderHook(() => useHasDataSourceInstance('test-db'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasInstance).toBe(true);
    expect(result.current.error).toBeUndefined();
  });

  it('resolves to false for an unknown type', async () => {
    const { result } = renderHook(() => useHasDataSourceInstance('nonexistent'));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasInstance).toBe(false);
  });

  it('updates instance presence when the cache is reloaded', async () => {
    const { result } = renderHook(() => useHasDataSourceInstance('new-db'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasInstance).toBe(false);

    backendGet.mockResolvedValue({
      datasources: { New: ds({ id: 5, uid: 'uid-new', name: 'New', type: 'new-db' }) },
      defaultDatasource: 'New',
    });
    await act(() => reloadDataSourceInstanceSettings());

    await waitFor(() => expect(result.current.hasInstance).toBe(true));
  });
});
