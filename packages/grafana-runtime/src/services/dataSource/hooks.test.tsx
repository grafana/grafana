import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';

import { setBackendSrv } from '../backendSrv';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { _resetForTests as resetPlugin, setDataSourcePluginImporter } from './dataSource';
import { useDataSourceInstance, useDataSourceInstanceSettingsList, useDataSourceInstanceSettings } from './hooks';
import { _resetForTests as resetInstanceSettings, initDataSourceInstanceSettings } from './settings';

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

beforeAll(() => {
  setTemplateSrv(templateSrv);
  setBackendSrv({
    get: jest.fn().mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

beforeEach(() => {
  resetInstanceSettings();
  resetPlugin();
  initDataSourceInstanceSettings(fixtures, 'Bravo');
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
});

describe('useDataSourceInstanceSettingsList', () => {
  it('populates items', async () => {
    const { result } = renderHook(() => useDataSourceInstanceSettingsList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
  });

  it('does not re-fetch when the same filter function reference is re-rendered', async () => {
    const stableFilter = (x: DataSourceInstanceSettings) => Boolean(x.meta.metrics);
    const { result, rerender } = renderHook(({ filter }) => useDataSourceInstanceSettingsList({ filter }), {
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
    const filterA = (x: DataSourceInstanceSettings) => x.name === 'Alpha';
    const filterB = (x: DataSourceInstanceSettings) => x.name === 'Bravo';

    const { result, rerender } = renderHook(({ filter }) => useDataSourceInstanceSettingsList({ filter }), {
      initialProps: { filter: filterA },
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.every((x) => x.name === 'Alpha')).toBe(true);

    rerender({ filter: filterB });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.items.every((x) => x.name === 'Bravo')).toBe(true);
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
});
