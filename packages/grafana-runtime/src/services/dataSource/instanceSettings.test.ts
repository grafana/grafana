import { type DataSourceInstanceSettings } from '@grafana/data';

import { invalidateCachedPromisesCache } from '../../utils/getCachedPromise';
import { setBackendSrv } from '../backendSrv';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests,
  getDataSourceSettingsList,
  getDataSourceSettings,
  initDataSources,
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
  Expression: ds({
    id: 0,
    uid: '__expr__',
    name: 'Expression',
    type: '__expr__',
    meta: { ...ds({}).meta, id: '__expr__', metrics: false },
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
  invalidateCachedPromisesCache();
  backendGet.mockReset();
});

describe('instanceSettings', () => {
  describe('getDataSourceSettings', () => {
    it('returns the cached value for a known uid without fetching', async () => {
      initDataSources(fixtures, 'Bravo');
      const result = await getDataSourceSettings('uid-alpha');
      expect(result?.name).toBe('Alpha');
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('returns the cached value for a known name', async () => {
      initDataSources(fixtures, 'Bravo');
      const result = await getDataSourceSettings('Charlie');
      expect(result?.uid).toBe('uid-charlie');
    });

    it('falls back to the default when ref is null', async () => {
      initDataSources(fixtures, 'Bravo');
      const result = await getDataSourceSettings(null);
      expect(result?.name).toBe('Bravo');
    });

    it('interpolates template variable refs and preserves the raw ref', async () => {
      initDataSources(fixtures, 'Bravo');
      const result = await getDataSourceSettings('${myds}');
      expect(result?.uid).toBe('${myds}');
      expect(result?.rawRef).toEqual({ type: 'test-db', uid: 'uid-alpha' });
    });

    it('fetches from the backend when cache is empty and miss', async () => {
      // Don't call init — simulates the very first access before boot data has
      // been pushed into the cache (e.g. from a non-Grafana mount point).
      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      const result = await getDataSourceSettings('uid-alpha');
      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
      expect(result?.name).toBe('Alpha');
    });

    it('resolves expression references by uid, name, and legacy id', async () => {
      initDataSources(fixtures, 'Bravo');
      const byUid = await getDataSourceSettings('__expr__');
      const byName = await getDataSourceSettings('Expression');
      const byLegacyId = await getDataSourceSettings('-100');

      expect(byUid?.uid).toBe('__expr__');
      expect(byName?.uid).toBe('__expr__');
      expect(byLegacyId?.uid).toBe('__expr__');
    });

    it('deduplicates concurrent fetches', async () => {
      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      const [a, b] = await Promise.all([getDataSourceSettings('uid-alpha'), getDataSourceSettings('uid-bravo')]);
      expect(backendGet).toHaveBeenCalledTimes(1);
      expect(a?.name).toBe('Alpha');
      expect(b?.name).toBe('Bravo');
    });
  });

  describe('getDataSourceSettingsList', () => {
    it('returns a paginated response shape', async () => {
      initDataSources(fixtures, 'Bravo');
      const page = await getDataSourceSettingsList();
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeUndefined();
      expect(Array.isArray(page.items)).toBe(true);
    });

    it('filters out built-in grafana / mixed / dashboard by default', async () => {
      initDataSources(fixtures, 'Bravo');
      const page = await getDataSourceSettingsList();
      const names = page.items.map((x) => x.name);
      expect(names).not.toContain('-- Mixed --');
      expect(names).not.toContain('-- Dashboard --');
      expect(names).toContain('Alpha');
      expect(names).toContain('Bravo');
    });

    it('honours the `mixed` filter', async () => {
      initDataSources(fixtures, 'Bravo');
      const page = await getDataSourceSettingsList({ filters: { mixed: true } });
      expect(page.items.some((x) => x.name === '-- Mixed --')).toBe(true);
    });

    it('honours the `tracing` filter and excludes metrics-only sources', async () => {
      initDataSources(fixtures, 'Bravo');
      const page = await getDataSourceSettingsList({ filters: { tracing: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toEqual(['Charlie']);
    });
  });

  describe('reload', () => {
    it('invalidates the cache and refetches', async () => {
      initDataSources(fixtures, 'Bravo');
      backendGet.mockResolvedValue({
        datasources: { Alpha: fixtures.Alpha },
        defaultDatasource: 'Alpha',
      });

      await reload();

      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
      const result = await getDataSourceSettings(null);
      expect(result?.name).toBe('Alpha');
    });
  });

  describe('upsertRuntimeDataSource', () => {
    it('makes the settings available to getDataSourceSettings', async () => {
      initDataSources({}, '');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSource(runtime);
      const result = await getDataSourceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });

    it('throws when the uid is already registered', () => {
      initDataSources(fixtures, 'Bravo');
      expect(() => upsertRuntimeDataSource(ds({ uid: 'uid-alpha', name: 'Dup' }))).toThrow(/already been registered/);
    });

    it('survives a refetch', async () => {
      initDataSources(fixtures, 'Bravo');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSource(runtime);

      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      await reload();

      const result = await getDataSourceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });
  });
});
