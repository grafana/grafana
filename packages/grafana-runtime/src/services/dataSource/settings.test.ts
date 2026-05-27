import { type DataSourceInstanceSettings } from '@grafana/data';

import { setBackendSrv } from '../backendSrv';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import {
  _resetForTests,
  getDataSourceInstanceSettingsList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
  reloadDataSourceInstanceSettings,
  upsertRuntimeDataSourceInstanceSettings,
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
  backendGet.mockReset();
});

describe('instanceSettings', () => {
  describe('getDataSourceInstanceSettings', () => {
    it('returns the cached value for a known uid without fetching', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings('uid-alpha');
      expect(result?.name).toBe('Alpha');
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('returns the cached value for a known name', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings('Charlie');
      expect(result?.uid).toBe('uid-charlie');
    });

    it('falls back to the default when ref is null', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings(null);
      expect(result?.name).toBe('Bravo');
    });

    it('interpolates template variable refs and preserves the raw ref', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings('${myds}');
      expect(result?.uid).toBe('${myds}');
      expect(result?.rawRef).toEqual({ type: 'test-db', uid: 'uid-alpha' });
    });

    it('returns undefined when cache has not been initialized', async () => {
      const result = await getDataSourceInstanceSettings('uid-alpha');
      expect(result).toBeUndefined();
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('resolves expression references by uid, name, and legacy id', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const byUid = await getDataSourceInstanceSettings('__expr__');
      const byName = await getDataSourceInstanceSettings('Expression');
      const byLegacyId = await getDataSourceInstanceSettings('-100');

      expect(byUid?.uid).toBe('__expr__');
      expect(byName?.uid).toBe('__expr__');
      expect(byLegacyId?.uid).toBe('__expr__');
    });

    it('resolves a DataSourceRef with type but no uid to a matching datasource', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings({ type: 'test-db' });
      expect(result).toBeDefined();
      expect(result?.type).toBe('test-db');
      // Prefers the default datasource of that type.
      expect(result?.isDefault).toBe(true);
    });

    it('falls back to the first datasource when type matches but none is default', async () => {
      const noDefault: Record<string, DataSourceInstanceSettings> = {
        Alpha: ds({ id: 1, uid: 'uid-alpha', name: 'Alpha', type: 'test-db' }),
        Charlie: ds({ id: 3, uid: 'uid-charlie', name: 'Charlie', type: 'test-db' }),
      };
      initDataSourceInstanceSettings(noDefault, 'Alpha');
      const result = await getDataSourceInstanceSettings({ type: 'test-db' });
      expect(result).toBeDefined();
      expect(result?.type).toBe('test-db');
    });

    it('returns a result for a type-only DataSourceRef even when no exact match exists', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings({ type: 'nonexistent' });
      // Matching legacy DatasourceSrv: findByType delegates to applyFilters
      // which always appends Grafana DS, so a non-matching type still resolves.
      expect(result).toBeDefined();
    });

    it('resolves by numeric id as a string fallback', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings('3');
      expect(result?.name).toBe('Charlie');
    });

    it('returns undefined when a template variable resolves to a missing datasource', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const result = await getDataSourceInstanceSettings('${missing}');
      expect(result).toBeUndefined();
    });
  });

  describe('getDataSourceInstanceSettingsList', () => {
    it('returns a paginated response shape', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList();
      expect(page.hasMore).toBe(false);
      expect(page.nextCursor).toBeUndefined();
      expect(Array.isArray(page.items)).toBe(true);
    });

    it('filters out built-in grafana / mixed / dashboard by default', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList();
      const names = page.items.map((x) => x.name);
      expect(names).not.toContain('-- Mixed --');
      expect(names).not.toContain('-- Dashboard --');
      expect(names).toContain('Alpha');
      expect(names).toContain('Bravo');
    });

    it('honours the `mixed` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { mixed: true } });
      expect(page.items.some((x) => x.name === '-- Mixed --')).toBe(true);
    });

    it('honours the `tracing` filter and excludes metrics-only sources', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { tracing: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toEqual(['Charlie']);
    });

    it('honours the `metrics` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { metrics: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toContain('Alpha');
      expect(names).not.toContain('Charlie');
    });

    it('honours the `logs` filter', async () => {
      const withLogs: Record<string, DataSourceInstanceSettings> = {
        Loki: ds({
          id: 10,
          uid: 'uid-loki',
          name: 'Loki',
          type: 'loki',
          meta: { ...ds({}).meta, id: 'loki', metrics: false, logs: true },
        }),
        Alpha: fixtures.Alpha,
      };
      initDataSourceInstanceSettings(withLogs, 'Alpha');
      const page = await getDataSourceInstanceSettingsList({ filters: { logs: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toContain('Loki');
      expect(names).not.toContain('Alpha');
    });

    it('honours the `annotations` filter', async () => {
      const withAnnotations: Record<string, DataSourceInstanceSettings> = {
        Annotator: ds({
          id: 10,
          uid: 'uid-annotator',
          name: 'Annotator',
          type: 'annotator',
          meta: { ...ds({}).meta, id: 'annotator', metrics: false, annotations: true },
        }),
        Alpha: fixtures.Alpha,
      };
      initDataSourceInstanceSettings(withAnnotations, 'Alpha');
      const page = await getDataSourceInstanceSettingsList({ filters: { annotations: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toContain('Annotator');
      expect(names).not.toContain('Alpha');
    });

    it('honours the `alerting` filter', async () => {
      const withAlerting: Record<string, DataSourceInstanceSettings> = {
        Alerter: ds({
          id: 10,
          uid: 'uid-alerter',
          name: 'Alerter',
          type: 'alerter',
          meta: { ...ds({}).meta, id: 'alerter', metrics: false, alerting: true },
        }),
        Alpha: fixtures.Alpha,
      };
      initDataSourceInstanceSettings(withAlerting, 'Alpha');
      const page = await getDataSourceInstanceSettingsList({ filters: { alerting: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toContain('Alerter');
      expect(names).not.toContain('Alpha');
    });

    it('honours the `type` filter with a string', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { type: 'test-db' } });
      // Grafana DS is always appended, so filter the base items.
      const baseItems = page.items.filter((x) => x.meta.id !== 'grafana');
      expect(baseItems.every((x) => x.type === 'test-db')).toBe(true);
      expect(baseItems.length).toBeGreaterThan(0);
    });

    it('honours the `type` filter with an array', async () => {
      const mixed: Record<string, DataSourceInstanceSettings> = {
        Prom: ds({
          id: 10,
          uid: 'uid-prom',
          name: 'Prom',
          type: 'prometheus',
          meta: { ...ds({}).meta, id: 'prometheus', metrics: true },
        }),
        Alpha: fixtures.Alpha,
      };
      initDataSourceInstanceSettings(mixed, 'Alpha');
      const page = await getDataSourceInstanceSettingsList({ filters: { type: ['prometheus', 'test-db'] } });
      expect(page.items.length).toBe(2);
    });

    it('honours a custom `filter` function', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({
        filters: { filter: (x) => x.name === 'Alpha' },
      });
      const names = page.items.map((x) => x.name);
      expect(names).toEqual(['Alpha']);
    });

    it('excludes datasources with no capabilities unless `all` is set', async () => {
      const noCapability: Record<string, DataSourceInstanceSettings> = {
        NoOp: ds({
          id: 10,
          uid: 'uid-noop',
          name: 'NoOp',
          type: 'noop',
          meta: {
            ...ds({}).meta,
            id: 'noop',
            metrics: false,
            annotations: false,
            tracing: false,
            logs: false,
            alerting: false,
          },
        }),
        Alpha: fixtures.Alpha,
      };
      initDataSourceInstanceSettings(noCapability, 'Alpha');

      const withoutAll = await getDataSourceInstanceSettingsList();
      expect(withoutAll.items.map((x) => x.name)).not.toContain('NoOp');

      const withAll = await getDataSourceInstanceSettingsList({ filters: { all: true } });
      expect(withAll.items.map((x) => x.name)).toContain('NoOp');
    });

    it('honours the `dashboard` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { dashboard: true } });
      expect(page.items.some((x) => x.name === '-- Dashboard --')).toBe(true);
    });

    it('includes Grafana DS by default but excludes it when tracing filter is set', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');

      const defaultPage = await getDataSourceInstanceSettingsList();
      expect(defaultPage.items.some((x) => x.name === '-- Grafana --')).toBe(true);

      const tracingPage = await getDataSourceInstanceSettingsList({ filters: { tracing: true } });
      expect(tracingPage.items.some((x) => x.name === '-- Grafana --')).toBe(false);
    });

    it('does not add built-in datasources when alerting filter is set', async () => {
      const withAlerting: Record<string, DataSourceInstanceSettings> = {
        ...fixtures,
        Alerter: ds({
          id: 10,
          uid: 'uid-alerter',
          name: 'Alerter',
          type: 'alerter',
          meta: { ...ds({}).meta, id: 'alerter', metrics: false, alerting: true },
        }),
      };
      initDataSourceInstanceSettings(withAlerting, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { alerting: true, mixed: true } });
      expect(page.items.some((x) => x.name === '-- Mixed --')).toBe(false);
      expect(page.items.some((x) => x.name === '-- Grafana --')).toBe(false);
    });

    it('does not include runtime datasources in list results', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      upsertRuntimeDataSourceInstanceSettings(ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' }));

      const page = await getDataSourceInstanceSettingsList({ filters: { all: true } });
      expect(page.items.some((x) => x.uid === 'runtime-ds')).toBe(false);
    });

    it('injects datasource variables when `variables` filter is set', async () => {
      setTemplateSrv({
        ...templateSrv,
        getVariables: () => [{ type: 'datasource', name: 'dsVar', current: { value: 'uid-alpha' } }],
      } as unknown as TemplateSrv);

      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList({ filters: { variables: true } });
      const names = page.items.map((x) => x.name);
      expect(names).toContain('${dsVar}');

      // Restore original templateSrv
      setTemplateSrv(templateSrv);
    });

    it('returns items sorted alphabetically by name', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const page = await getDataSourceInstanceSettingsList();
      const names = page.items.filter((x) => x.name !== '-- Grafana --').map((x) => x.name);
      const sorted = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      expect(names).toEqual(sorted);
    });
  });

  describe('reload', () => {
    it('invalidates the cache and refetches', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      backendGet.mockResolvedValue({
        datasources: { Alpha: fixtures.Alpha },
        defaultDatasource: 'Alpha',
      });

      await reloadDataSourceInstanceSettings();

      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
      const result = await getDataSourceInstanceSettings(null);
      expect(result?.name).toBe('Alpha');
    });
  });

  describe('upsertRuntimeDataSourceInstanceSettings', () => {
    it('makes the settings available to getDataSourceInstanceSettings', async () => {
      initDataSourceInstanceSettings({}, '');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSourceInstanceSettings(runtime);
      const result = await getDataSourceInstanceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });

    it('throws when the uid is already registered', () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      expect(() => upsertRuntimeDataSourceInstanceSettings(ds({ uid: 'uid-alpha', name: 'Dup' }))).toThrow(
        /already been registered/
      );
    });

    it('survives a refetch', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSourceInstanceSettings(runtime);

      backendGet.mockResolvedValue({ datasources: fixtures, defaultDatasource: 'Bravo' });
      await reloadDataSourceInstanceSettings();

      const result = await getDataSourceInstanceSettings('runtime-ds');
      expect(result?.name).toBe('Runtime');
    });
  });
});
