import { type DataSourceApi, type DataSourceInstanceSettings } from '@grafana/data';

import { setBackendSrv } from '../backendSrv';
import { type DataSourceSrv, setDataSourceSrv } from '../dataSourceSrv';
import { setLogger } from '../logging/registry';
import { setTemplateSrv, type TemplateSrv } from '../templateSrv';

import { FALLBACK_TO_LEGACY_LIST_WARNING, FALLBACK_TO_LEGACY_SETTINGS_WARNING } from './constants';
import { setExpressionDataSourceInstance } from './expressionDs';
import {
  _resetForTests,
  getDataSourceInstanceList,
  getDataSourceInstanceSettings,
  initDataSourceInstanceSettings,
  reloadDataSourceInstanceSettings,
  syncDataSourceInstanceSettings,
  upsertRuntimeDataSourceInstanceSettings,
} from './settings';

// The expression singleton retains its full instance settings as a public
// field; the runtime APIs read settings off the registered instance.
function expressionInstance(settings: DataSourceInstanceSettings): DataSourceApi {
  return { instanceSettings: settings } as unknown as DataSourceApi;
}

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
const logWarning = jest.fn();

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
  logWarning.mockClear();
  setLogger('grafana/runtime.plugins.datasource', {
    logDebug: jest.fn(),
    logError: jest.fn(),
    logInfo: jest.fn(),
    logMeasurement: jest.fn(),
    logWarning,
  });
  // No legacy srv by default — reloadDataSourceInstanceSettings() should use the fetch path.
  setDataSourceSrv(undefined as unknown as DataSourceSrv);
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
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
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

    // Scenarios the legacy DatasourceSrv.getInstanceSettings handles that weren't covered above.
    describe('the "default" keyword and DataSourceRef objects', () => {
      it('resolves the literal string "default" to the configured default datasource', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const result = await getDataSourceInstanceSettings('default');
        expect(result?.name).toBe('Bravo');
      });

      it('resolves a DataSourceRef object by uid', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const result = await getDataSourceInstanceSettings({ uid: 'uid-alpha' });
        expect(result?.name).toBe('Alpha');
      });

      it('prefers uid over type when a DataSourceRef has both', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const result = await getDataSourceInstanceSettings({ uid: 'uid-charlie', type: 'test-db' });
        expect(result?.uid).toBe('uid-charlie');
      });
    });

    describe('expression references in object form', () => {
      it('resolves a DataSourceRef with the new expression type (__expr__)', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
        const result = await getDataSourceInstanceSettings({ type: '__expr__' });
        expect(result?.uid).toBe('__expr__');
      });

      it('resolves a DataSourceRef with the legacy expression type (-100)', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
        const result = await getDataSourceInstanceSettings({ type: '-100' });
        expect(result?.uid).toBe('__expr__');
      });
    });

    describe('template variables', () => {
      it('resolves a variable that interpolates to "default"', async () => {
        setTemplateSrv({
          ...templateSrv,
          replace: (value?: string) => (value === '${dsVar}' ? 'default' : (value ?? '')),
        } as unknown as TemplateSrv);
        initDataSourceInstanceSettings(fixtures, 'Bravo');

        const result = await getDataSourceInstanceSettings('${dsVar}');
        expect(result?.uid).toBe('${dsVar}');
        expect(result?.isDefault).toBe(false);
        expect(result?.rawRef).toEqual({ type: 'test-db', uid: 'uid-bravo' });

        setTemplateSrv(templateSrv);
      });

      it('uses the first value of a multi-value variable', async () => {
        // The interpolation callback (3rd arg to replace) collapses an array to its
        // first element; drive replace through that callback to mirror production.
        setTemplateSrv({
          ...templateSrv,
          replace: (value: string, _scopedVars: unknown, format: (v: unknown) => unknown) =>
            value === '${multi}' ? String(format(['Alpha', 'Bravo'])) : value,
        } as unknown as TemplateSrv);
        initDataSourceInstanceSettings(fixtures, 'Bravo');

        const result = await getDataSourceInstanceSettings('${multi}');
        expect(result?.rawRef).toEqual({ type: 'test-db', uid: 'uid-alpha' });

        setTemplateSrv(templateSrv);
      });

      it('forwards scopedVars to the template service', async () => {
        const replace = jest.fn().mockReturnValue('Alpha');
        setTemplateSrv({ ...templateSrv, replace } as unknown as TemplateSrv);
        initDataSourceInstanceSettings(fixtures, 'Bravo');

        const scopedVars = { foo: { text: 'x', value: 1 } };
        await getDataSourceInstanceSettings('${withScope}', scopedVars);

        expect(replace).toHaveBeenCalledWith('${withScope}', scopedVars, expect.any(Function));

        setTemplateSrv(templateSrv);
      });
    });
  });

  describe('getDataSourceInstanceList', () => {
    it('returns an array of list items', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList();
      expect(Array.isArray(items)).toBe(true);
    });

    it('filters out built-in grafana / mixed / dashboard by default', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList();
      const names = items.map((x) => x.name);
      expect(names).not.toContain('-- Mixed --');
      expect(names).not.toContain('-- Dashboard --');
      expect(names).toContain('Alpha');
      expect(names).toContain('Bravo');
    });

    it('honours the `mixed` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ mixed: true });
      expect(items.some((x) => x.name === '-- Mixed --')).toBe(true);
    });

    it('honours the `tracing` filter and excludes metrics-only sources', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ tracing: true });
      const names = items.map((x) => x.name);
      expect(names).toEqual(['Charlie']);
    });

    it('honours the `metrics` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ metrics: true });
      const names = items.map((x) => x.name);
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
      const items = await getDataSourceInstanceList({ logs: true });
      const names = items.map((x) => x.name);
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
      const items = await getDataSourceInstanceList({ annotations: true });
      const names = items.map((x) => x.name);
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
      const items = await getDataSourceInstanceList({ alerting: true });
      const names = items.map((x) => x.name);
      expect(names).toContain('Alerter');
      expect(names).not.toContain('Alpha');
    });

    it('honours the `type` filter with a string', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ type: 'test-db' });
      // Grafana DS is always appended, so filter the base items.
      const baseItems = items.filter((x) => x.meta.id !== 'grafana');
      expect(baseItems.every((x) => x.ref.type === 'test-db')).toBe(true);
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
      const items = await getDataSourceInstanceList({ type: ['prometheus', 'test-db'] });
      expect(items.length).toBe(2);
    });

    it('honours a custom `filter` function', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ filter: (x) => x.name === 'Alpha' });
      const names = items.map((x) => x.name);
      expect(names).toEqual(['Alpha']);
    });

    it('does not apply the custom `filter` to -- Mixed -- or -- Dashboard -- (matching legacy getList semantics)', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      // A filter that would exclude built-ins if applied universally.
      const items = await getDataSourceInstanceList({
        mixed: true,
        dashboard: true,
        filter: (x) => !x.name.startsWith('--'),
      });
      const names = items.map((x) => x.name);
      expect(names).toContain('-- Mixed --');
      expect(names).toContain('-- Dashboard --');
      expect(names).not.toContain('-- Grafana --');
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

      const withoutAll = await getDataSourceInstanceList();
      expect(withoutAll.map((x) => x.name)).not.toContain('NoOp');

      const withAll = await getDataSourceInstanceList({ all: true });
      expect(withAll.map((x) => x.name)).toContain('NoOp');
    });

    it('honours the `dashboard` filter', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ dashboard: true });
      expect(items.some((x) => x.name === '-- Dashboard --')).toBe(true);
    });

    it('includes Grafana DS by default but excludes it when tracing filter is set', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');

      const defaultItems = await getDataSourceInstanceList();
      expect(defaultItems.some((x) => x.name === '-- Grafana --')).toBe(true);

      const tracingItems = await getDataSourceInstanceList({ tracing: true });
      expect(tracingItems.some((x) => x.name === '-- Grafana --')).toBe(false);
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
      const items = await getDataSourceInstanceList({ alerting: true, mixed: true });
      expect(items.some((x) => x.name === '-- Mixed --')).toBe(false);
      expect(items.some((x) => x.name === '-- Grafana --')).toBe(false);
    });

    it('does not include runtime datasources in list results', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      upsertRuntimeDataSourceInstanceSettings(ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' }));

      const items = await getDataSourceInstanceList({ all: true });
      expect(items.some((x) => x.ref.uid === 'runtime-ds')).toBe(false);
    });

    it('injects datasource variables when `variables` filter is set', async () => {
      setTemplateSrv({
        ...templateSrv,
        getVariables: () => [{ type: 'datasource', name: 'dsVar', current: { value: 'uid-alpha' } }],
      } as unknown as TemplateSrv);

      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList({ variables: true });
      const names = items.map((x) => x.name);
      expect(names).toContain('${dsVar}');

      // Restore original templateSrv
      setTemplateSrv(templateSrv);
    });

    it('returns items sorted alphabetically by name', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const items = await getDataSourceInstanceList();
      const names = items.filter((x) => x.name !== '-- Grafana --').map((x) => x.name);
      const sorted = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      expect(names).toEqual(sorted);
    });

    describe('pluginId and type matching', () => {
      it('matches pluginId via meta.aliasIDs', async () => {
        const withAlias: Record<string, DataSourceInstanceSettings> = {
          CloudWatch: ds({
            id: 20,
            uid: 'uid-cw',
            name: 'CloudWatch',
            type: 'cloudwatch',
            meta: { ...ds({}).meta, id: 'cloudwatch', aliasIDs: ['aws-cloudwatch'], metrics: true },
          }),
          Alpha: fixtures.Alpha,
        };
        initDataSourceInstanceSettings(withAlias, 'Alpha');
        const items = await getDataSourceInstanceList({ pluginId: 'aws-cloudwatch' });
        // pluginId filter suppresses the always-appended built-ins, so only the match remains.
        expect(items.map((x) => x.name)).toEqual(['CloudWatch']);
      });

      it('matches the type filter via meta.aliasIDs', async () => {
        const withAlias: Record<string, DataSourceInstanceSettings> = {
          Real: ds({
            id: 21,
            uid: 'uid-real',
            name: 'Real',
            type: 'real-type',
            meta: { ...ds({}).meta, id: 'real', aliasIDs: ['legacy-type'], metrics: true },
          }),
          Alpha: fixtures.Alpha,
        };
        initDataSourceInstanceSettings(withAlias, 'Alpha');
        const items = await getDataSourceInstanceList({ type: 'legacy-type' });
        expect(items.some((x) => x.name === 'Real')).toBe(true);
        expect(items.some((x) => x.name === 'Alpha')).toBe(false);
      });

      it('does not append built-in datasources when pluginId is set', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const items = await getDataSourceInstanceList({ pluginId: 'test-db', mixed: true, dashboard: true });
        const names = items.map((x) => x.name);
        expect(names).not.toContain('-- Mixed --');
        expect(names).not.toContain('-- Dashboard --');
        expect(names).not.toContain('-- Grafana --');
      });
    });

    describe('datasource variable injection', () => {
      it('uses the first value of a multi-value datasource variable', async () => {
        setTemplateSrv({
          ...templateSrv,
          getVariables: () => [{ type: 'datasource', name: 'dsVar', current: { value: ['uid-alpha', 'uid-bravo'] } }],
        } as unknown as TemplateSrv);
        initDataSourceInstanceSettings(fixtures, 'Bravo');

        const items = await getDataSourceInstanceList({ variables: true });
        const injected = items.find((x) => x.name === '${dsVar}');
        // The first value (uid-alpha) resolves to Alpha.
        expect(injected?.ref.type).toBeDefined();
        expect(injected?.ref.type).toBe('test-db');

        setTemplateSrv(templateSrv);
      });

      it('resolves a datasource variable whose value is "default"', async () => {
        setTemplateSrv({
          ...templateSrv,
          getVariables: () => [{ type: 'datasource', name: 'dsVar', current: { value: 'default' } }],
        } as unknown as TemplateSrv);
        initDataSourceInstanceSettings(fixtures, 'Bravo');

        const items = await getDataSourceInstanceList({ variables: true });
        const injected = items.find((x) => x.name === '${dsVar}');
        // 'default' maps to the configured default datasource (Bravo).
        expect(injected).toBeDefined();
        expect(injected?.ref.uid).toBe('${dsVar}');
        expect(injected?.ref.type).toBe('test-db');

        setTemplateSrv(templateSrv);
      });
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

    it('delegates to DataSourceSrv.reload when a legacy srv is registered, without fetching directly', async () => {
      const reload = jest.fn();
      setDataSourceSrv({ reload } as unknown as DataSourceSrv);

      await reloadDataSourceInstanceSettings();

      expect(reload).toHaveBeenCalledTimes(1);
      expect(backendGet).not.toHaveBeenCalled();
    });

    it('coalesces concurrent reloads into a single underlying reload', async () => {
      const reload = jest.fn().mockResolvedValue(undefined);
      setDataSourceSrv({ reload } as unknown as DataSourceSrv);

      // Both calls start before the first settles, so they share one in-flight reload.
      await Promise.all([reloadDataSourceInstanceSettings(), reloadDataSourceInstanceSettings()]);

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('starts a fresh reload once the previous one has settled', async () => {
      const reload = jest.fn().mockResolvedValue(undefined);
      setDataSourceSrv({ reload } as unknown as DataSourceSrv);

      await reloadDataSourceInstanceSettings();
      await reloadDataSourceInstanceSettings();

      expect(reload).toHaveBeenCalledTimes(2);
    });
  });

  describe('syncDataSourceInstanceSettings', () => {
    it('populates the cache from a prefetched payload without fetching', async () => {
      initDataSourceInstanceSettings({ Bravo: fixtures.Bravo }, 'Bravo');

      syncDataSourceInstanceSettings({ datasources: { Alpha: fixtures.Alpha }, defaultDatasource: 'Alpha' });

      expect(backendGet).not.toHaveBeenCalled();
      const list = await getDataSourceInstanceList({ all: true });
      expect(list.map((x) => x.name)).toEqual(['Alpha']);
      expect((await getDataSourceInstanceSettings(null))?.name).toBe('Alpha');
    });

    it('preserves a built-in datasource and keeps it out of the list', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings(fixtures, 'Bravo');

      // Sync a payload that does not include the expression datasource.
      syncDataSourceInstanceSettings({ datasources: { Alpha: fixtures.Alpha }, defaultDatasource: 'Alpha' });

      expect((await getDataSourceInstanceSettings('__expr__'))?.uid).toBe('__expr__');
      const items = await getDataSourceInstanceList({ all: true });
      expect(items.some((x) => x.ref.uid === '__expr__')).toBe(false);
    });

    it('preserves a runtime datasource', async () => {
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      upsertRuntimeDataSourceInstanceSettings(ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' }));

      syncDataSourceInstanceSettings({ datasources: { Alpha: fixtures.Alpha }, defaultDatasource: 'Alpha' });

      expect((await getDataSourceInstanceSettings('runtime-ds'))?.name).toBe('Runtime');
    });
  });

  describe('setExpressionDataSourceInstance', () => {
    it('makes the expression datasource available by uid after init', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings({}, '');
      const result = await getDataSourceInstanceSettings('__expr__');
      expect(result?.uid).toBe('__expr__');
    });

    it('resolves by name via isExpressionReference path', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings({}, '');
      const result = await getDataSourceInstanceSettings('Expression');
      expect(result?.uid).toBe('__expr__');
    });

    it('resolves by legacy id -100 via isExpressionReference path', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings({}, '');
      const result = await getDataSourceInstanceSettings('-100');
      expect(result?.uid).toBe('__expr__');
    });

    it('returns undefined for an expression ref when no instance is registered', async () => {
      initDataSourceInstanceSettings({}, '');
      const result = await getDataSourceInstanceSettings('__expr__');
      expect(result).toBeUndefined();
    });

    it('is not returned by getDataSourceInstanceList (matching legacy)', async () => {
      // The expression datasource lives only on the registered instance, never
      // in the name/uid maps the list is built from.
      const { Expression: _expr, ...withoutExpression } = fixtures;
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings(withoutExpression, 'Bravo');
      const items = await getDataSourceInstanceList({ all: true });
      expect(items.some((x) => x.ref.uid === '__expr__')).toBe(false);
    });

    it('survives a cache repopulate via no-arg reload', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings(fixtures, 'Bravo');

      // Reload with a payload that does not include the expression datasource.
      backendGet.mockResolvedValue({ datasources: { Alpha: fixtures.Alpha }, defaultDatasource: 'Alpha' });
      await reloadDataSourceInstanceSettings();

      const result = await getDataSourceInstanceSettings('__expr__');
      expect(result?.uid).toBe('__expr__');
      expect(backendGet).toHaveBeenCalledWith('/api/frontend/settings');
    });

    it('coexists with a runtime datasource and both survive a repopulate', async () => {
      setExpressionDataSourceInstance(expressionInstance(fixtures.Expression));
      initDataSourceInstanceSettings(fixtures, 'Bravo');
      const runtime = ds({ uid: 'runtime-ds', name: 'Runtime', type: 'runtime' });
      upsertRuntimeDataSourceInstanceSettings(runtime);

      backendGet.mockResolvedValue({ datasources: { Alpha: fixtures.Alpha }, defaultDatasource: 'Alpha' });
      await reloadDataSourceInstanceSettings();

      expect((await getDataSourceInstanceSettings('__expr__'))?.uid).toBe('__expr__');
      expect((await getDataSourceInstanceSettings('runtime-ds'))?.name).toBe('Runtime');
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

  describe('legacy DataSourceSrv fallback', () => {
    describe('getDataSourceInstanceSettings', () => {
      it('falls back to the legacy srv and logs a warning when the new cache misses but legacy resolves', async () => {
        initDataSourceInstanceSettings({}, '');
        const getInstanceSettings = jest.fn().mockReturnValue(fixtures.Alpha);
        setDataSourceSrv({ getInstanceSettings } as unknown as DataSourceSrv);

        const result = await getDataSourceInstanceSettings('uid-alpha');

        expect(result).toBe(fixtures.Alpha);
        expect(getInstanceSettings).toHaveBeenCalledWith('uid-alpha', undefined);
        expect(logWarning).toHaveBeenCalledTimes(1);
        expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_SETTINGS_WARNING, { ref: 'uid-alpha' });
      });

      it('returns undefined and does not log when both the new cache and the legacy srv miss', async () => {
        initDataSourceInstanceSettings({}, '');
        const getInstanceSettings = jest.fn().mockReturnValue(undefined);
        setDataSourceSrv({ getInstanceSettings } as unknown as DataSourceSrv);

        const result = await getDataSourceInstanceSettings('uid-alpha');

        expect(result).toBeUndefined();
        expect(getInstanceSettings).toHaveBeenCalledTimes(1);
        expect(logWarning).not.toHaveBeenCalled();
      });

      it('never consults the legacy srv when the new cache hits', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const getInstanceSettings = jest.fn();
        setDataSourceSrv({ getInstanceSettings } as unknown as DataSourceSrv);

        const result = await getDataSourceInstanceSettings('uid-alpha');

        expect(result?.name).toBe('Alpha');
        expect(getInstanceSettings).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
      });
    });

    describe('getDataSourceInstanceList', () => {
      it('falls back to the legacy srv and logs a warning when the new list is empty but legacy is not', async () => {
        initDataSourceInstanceSettings({}, '');
        const getList = jest.fn().mockReturnValue([fixtures.Alpha]);
        setDataSourceSrv({ getList } as unknown as DataSourceSrv);

        const items = await getDataSourceInstanceList({ metrics: true });

        expect(items).toEqual([
          {
            ref: { uid: fixtures.Alpha.uid, type: fixtures.Alpha.type, apiVersion: fixtures.Alpha.apiVersion },
            name: fixtures.Alpha.name,
            meta: fixtures.Alpha.meta,
            readOnly: fixtures.Alpha.readOnly,
            isDefault: fixtures.Alpha.isDefault,
          },
        ]);
        expect(getList).toHaveBeenCalledWith({ metrics: true });
        expect(logWarning).toHaveBeenCalledTimes(1);
        expect(logWarning).toHaveBeenCalledWith(FALLBACK_TO_LEGACY_LIST_WARNING, {
          filters: JSON.stringify({ metrics: true }),
        });
      });

      it('returns the empty list and does not log when both the new list and the legacy srv are empty', async () => {
        initDataSourceInstanceSettings({}, '');
        const getList = jest.fn().mockReturnValue([]);
        setDataSourceSrv({ getList } as unknown as DataSourceSrv);

        const items = await getDataSourceInstanceList({ metrics: true });

        expect(items).toEqual([]);
        expect(getList).toHaveBeenCalledTimes(1);
        expect(logWarning).not.toHaveBeenCalled();
      });

      it('never consults the legacy srv when the new list is non-empty', async () => {
        initDataSourceInstanceSettings(fixtures, 'Bravo');
        const getList = jest.fn();
        setDataSourceSrv({ getList } as unknown as DataSourceSrv);

        const items = await getDataSourceInstanceList();

        expect(items.length).toBeGreaterThan(0);
        expect(getList).not.toHaveBeenCalled();
        expect(logWarning).not.toHaveBeenCalled();
      });
    });
  });
});
