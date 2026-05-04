import { act, renderHook, waitFor } from '@testing-library/react';

import { type DataSourceInstanceSettings } from '@grafana/data';

import { invalidateCache } from '../../utils/getCachedPromise';
import { setBackendSrv } from '../backendSrv';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { useDataSourcePlugin, useInstanceSettings, useInstanceSettingsList } from './hooks';
import { _resetForTests as resetInstanceSettings, init } from './instanceSettings';
import { _resetForTests as resetPlugin, setDataSourcePluginImporter } from './plugin';

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
  invalidateCache();
  init(fixtures, 'Bravo');
});

describe('useInstanceSettings', () => {
  it('starts loading then resolves to data', async () => {
    const { result } = renderHook(() => useInstanceSettings('uid-alpha'));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.name).toBe('Alpha');
    expect(result.current.error).toBeUndefined();
  });

  it('refetches when the ref changes', async () => {
    const { result, rerender } = renderHook(({ ref }) => useInstanceSettings(ref), {
      initialProps: { ref: 'uid-alpha' },
    });

    await waitFor(() => expect(result.current.data?.name).toBe('Alpha'));

    rerender({ ref: 'uid-bravo' });
    await waitFor(() => expect(result.current.data?.name).toBe('Bravo'));
  });
});

describe('useInstanceSettingsList', () => {
  it('populates items and reports hasMore=false for the initial page', async () => {
    const { result } = renderHook(() => useInstanceSettingsList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items.length).toBeGreaterThan(0);
    expect(result.current.hasMore).toBe(false);
  });

  it('is safe to call fetchMore when there are no more pages', async () => {
    const { result } = renderHook(() => useInstanceSettingsList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.fetchMore();
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });
});

describe('useDataSourcePlugin', () => {
  class TestDs {
    constructor(public instanceSettings: DataSourceInstanceSettings) {}
  }

  it('starts loading then resolves to a plugin instance', async () => {
    const { DataSourcePlugin } = jest.requireActual('@grafana/data');
    setDataSourcePluginImporter({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      importDataSource: () => Promise.resolve(new DataSourcePlugin(TestDs as any)),
    });

    const { result } = renderHook(() => useDataSourcePlugin('uid-alpha'));
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toBeTruthy();
    expect(result.current.error).toBeUndefined();
  });

  it('reports errors when lookup fails', async () => {
    setDataSourcePluginImporter({
      importDataSource: () => Promise.reject(new Error('boom')),
    });

    const { result } = renderHook(() => useDataSourcePlugin('missing'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
