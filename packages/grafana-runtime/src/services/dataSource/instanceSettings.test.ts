import { type DataSourceInstanceSettings } from '@grafana/data';

import { invalidateCache } from '../../utils/getCachedPromise';
import { setBackendSrv } from '../backendSrv';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests,
  getInstanceSettings,
  getInstanceSettingsList,
  init,
  reload,
  upsertRuntimeDataSource,
} from './instanceSettings';

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
  Bravo: ds({
    id: 2,
    uid: 'uid-bravo',
    name: 'Bravo',
    type: 'test-db',
    isDefault: true,
  }),
  Charlie: ds({
    id: 3,
    uid: 'uid-charlie',
    name: 'Charlie',
    type: 'test-db',
    meta: { ...ds({}).meta, id: 'charlie', metrics: false, tracing: true },
  }),
  '-- Grafana --': ds({
    id: 4,
    uid: '-- Grafana --',
    name: '-- Grafana --',
    type: 'grafana',
    meta: { ...ds({}).meta, id: 'grafana', metrics: true },
  }),
  '-- Mixed --': ds({
    id: 5,
    uid: '-- Mixed --',
    name: '-- Mixed --',
    type: 'mixed',
    meta: { ...ds({}).meta, id: 'mixed', metrics: true },
  }),
  '-- Dashboard --': ds({
    id: 6,
    uid: '-- Dashboard --',
    name: '-- Dashboard --',
    type: 'dashboard',
    meta: { ...ds({}).meta, id: 'dashboard', metrics: true },
  }),
};

const templateSrv: TemplateSrv = {
  getVariables: () => [],
  replace: (value?: string) => {
    if (value === '${myds}') {
      return 'Alpha';
    }
    if (value === '${missing}') {
      return 'Nonexistent';
    }
    return value ?? '';
  },
  containsTemplate: () => false,
  updateTimeRange: () => {},
  getVariableName: () => undefined,
} as unknown as TemplateSrv;

const backendGet = jest.fn();

beforeAll(() => {
  setTemplateSrv(templateSrv);
  setBackendSrv({
    get: backendGet,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
});

beforeEach(() => {
  _resetForTests();
  invalidateCache();
  backendGet.mockReset();
});

describe('instanceSettings', () => {
  describe('getInstanceSettings', () => {
    it('returns the cached value for a known uid without fetching', async () => {
      init(fixtures, 'Bravo');
      const result = await getInstanceSettings('uid-alpha');
      expect(result?.name).toBe('Alpha');
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('returns the cached value for a known name', async () => {
      init(fixtures, 'Bravo');
      const result = await getInstanceSettings('Charlie');
      expect(result?.uid).toBe('uid-charlie');
    });

    it('falls back to the default when ref is null', async () => {
      init(fixtures, 'Bravo');
      const result = await getInstanceSettings(null);
      expect(result?.name).toBe('Bravo');
    });

    it('interpolates template variable refs and preserves the raw ref', async () => {
      init(fixtures, 'Bravo');
      const result = await getInstanceSettings('${myds}');
      expect(result?.uid).toBe('${myds}');
      expect(result?.rawRef).toEqual({ type: 'test-db', uid: 'uid-alpha' });
    });

    it('fetches from the backend when cache is empty and miss', async () => {
      // Don't call init — simulates the very first access before boot data has
      // been pushed into the cache (e.g. from a non-Grafana mount point).
      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      const result = await getInstanceSettings('uid-alpha');
      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
      expect(result?.name).toBe('Alpha');
    });

    it('deduplicates concurrent fetches', async () => {
      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      const [a, b] = await Promise.all([getInstanceSettings('uid-alpha'), getInstanceSettings('uid-bravo')]);
      expect(backendGet).toHaveBeenCalledTimes(1);
      expect(a?.name).toBe('Alpha');
      expect(b?.name).toBe('Bravo');
    });
  });

  describe('getInstanceSettingsList', () => {
    it('returns a paginated response shape', async () => {
      init(fixtures, 'Bravo');
      const page = await getInstanceSettingsList();
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeUndefined();
      expect(Array.isArray(page.items)).toBe(true);
    });

    it('filters out built-in grafana / mixed / dashboard by default', async () => {
      init(fixtures, 'Bravo');
      const page = await getInstanceSettingsList();
      const names = page.items.map((x) => x.name);
      expect(names).not.toContain('-- Mixed --');
      expect(names).not.toContain('-- Dashboard --');
      expect(names).toContain('Alpha');
      expect(names).toContain('Bravo');
    });

    it('honours the `mixed` filter', async () => {
      init(fixtures, 'Bravo');
      const page = await getInstanceSettingsList({ filters: { mixed: true } });
      expect(page.items.some((x) => x.name === '-- Mixed --')).toBe(true);
    });

    it('honours the `tracing` filter and excludes metrics-only sources', async () => {
      init(fixtures, 'Bravo');
      const page = await getInstanceSettingsList({ filters: { tracing: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toEqual(['Charlie']);
    });
  });

  describe('reload', () => {
    it('invalidates the cache and refetches', async () => {
      init(fixtures, 'Bravo');
      backendGet.mockResolvedValue({
        datasources: { Alpha: fixtures.Alpha },
        defaultDatasource: 'Alpha',
      });

      await reload();

      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
      const result = await getInstanceSettings(null);
      expect(result?.name).toBe('Alpha');
    });
  });

  describe('upsertRuntimeDataSource', () => {
    it('makes the settings available to getInstanceSettings', async () => {
      init({}, '');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSource(runtime);
      const result = await getInstanceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });

    it('throws when the uid is already registered', () => {
      init(fixtures, 'Bravo');
      expect(() => upsertRuntimeDataSource(ds({ uid: 'uid-alpha', name: 'Dup' }))).toThrow(/already been registered/);
    });

    it('survives a refetch', async () => {
      init(fixtures, 'Bravo');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSource(runtime);

      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      await reload();

      const result = await getInstanceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });
  });
});
