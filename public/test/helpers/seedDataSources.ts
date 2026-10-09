import { keyBy } from 'lodash';

import {
  type DataSourceApi,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type DataSourceRef,
} from '@grafana/data';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import {
  FALLBACK_TO_LEGACY_INSTANCE_WARNING,
  FALLBACK_TO_LEGACY_LIST_WARNING,
  FALLBACK_TO_LEGACY_SETTINGS_WARNING,
  setDataSourcePluginImporter,
  syncDataSourceInstanceSettings,
} from '@grafana/runtime/internal';
import { mockLogger } from '@grafana/test-utils/unstable';

/**
 * A data source to seed. Pass `api` when the test resolves an instance (`getDataSourceInstance`,
 * `useDataSourceInstance`, or the legacy `getDataSourceSrv().get`) — it is the object those calls
 * return. Settings alone are enough for lookups and lists.
 */
interface DataSourceFixture {
  settings: DataSourceInstanceSettings;
  api?: DataSourceApi;
}

type SeedableDataSource = DataSourceInstanceSettings | DataSourceFixture;

/** The subset of a data source plugin the instance loader reads. */
interface TestDataSourcePlugin {
  DataSourceClass: new (settings: DataSourceInstanceSettings) => DataSourceApi;
  components: unknown;
}

interface SeedDataSourcesOptions {
  /**
   * How to seed the legacy `DataSourceSrv`. Required with no default: whether a test still needs
   * the legacy service is the decision this util exists to make deliberate, and it is the option
   * that goes away when `DataSourceSrv` does.
   *
   * - `'none'` — no service at all, so the legacy fallback is inert and a lookup the new
   *   registries miss fails loudly. What a test wants once everything it reaches is migrated.
   * - `'mock'` — a minimal service backed by the same fixtures, for the call sites a test reaches
   *   that are not migrated yet.
   */
  legacySrv: 'mock' | 'none';
}

/**
 * Seed data sources for a test through both the async data source APIs and the legacy
 * `DataSourceSrv`, from one set of fixtures.
 *
 * Seeding only the legacy service makes migrated call sites resolve through the legacy fallback,
 * so the test asserts the old semantics no matter what the new path does. Use
 * {@link watchDataSourceFallbacks} to prove a suite never took that route.
 */
export function seedDataSources(dataSources: SeedableDataSource[], options: SeedDataSourcesOptions): void {
  const fixtures = dataSources.map(toFixture);
  const settings = keyBy(
    fixtures.map((fixture) => fixture.settings),
    (dsSettings) => dsSettings.name
  );
  const defaultDataSourceName =
    fixtures.find((fixture) => fixture.settings.isDefault)?.settings.name ?? fixtures[0]?.settings.name ?? '';

  // syncDataSourceInstanceSettings rather than initDataSourceInstanceSettings: it also clears the
  // constructed-instance cache. Suites re-seed per test, and a cached instance built from the
  // previous test's fixtures would otherwise be handed back for a uid this call just rebuilt.
  syncDataSourceInstanceSettings({ datasources: settings, defaultDatasource: defaultDataSourceName });
  setDataSourcePluginImporter(
    // The importer type is internal to @grafana/runtime; fixtures only need to supply what the
    // loader reads off the plugin.
    createFixtureImporter(fixtures) as unknown as Parameters<typeof setDataSourcePluginImporter>[0]
  );

  setDataSourceSrv(
    options.legacySrv === 'none'
      ? (undefined as unknown as DataSourceSrv)
      : createLegacyDataSourceSrvMock(fixtures, defaultDataSourceName)
  );
}

function toFixture(dataSource: SeedableDataSource): DataSourceFixture {
  return 'settings' in dataSource ? dataSource : { settings: dataSource };
}

function createFixtureImporter(fixtures: DataSourceFixture[]) {
  // Keyed on the meta object rather than meta.id: fixtures routinely share a plugin id, and the
  // loader passes back the very meta object the settings carry, so identity is both unique and
  // available. meta.id is the fallback for settings whose meta was cloned.
  const byMeta = new Map<DataSourcePluginMeta, DataSourceFixture>();
  const byPluginId = new Map<string, DataSourceFixture>();

  for (const fixture of fixtures) {
    byMeta.set(fixture.settings.meta, fixture);
    if (!byPluginId.has(fixture.settings.meta.id)) {
      byPluginId.set(fixture.settings.meta.id, fixture);
    }
  }

  return async (meta: DataSourcePluginMeta): Promise<TestDataSourcePlugin> => {
    const api = (byMeta.get(meta) ?? byPluginId.get(meta.id))?.api;
    if (!api) {
      throw new Error(
        `seedDataSources: no api fixture for data source plugin "${meta.id}". Seed it as { settings, api }.`
      );
    }
    // `new` on a function returning an object yields that object, so the instance is the fixture
    // api itself and the handles a test holds (e.g. query mocks) stay live. components is returned
    // because the loader overwrites instance.components with whatever the plugin supplies.
    return {
      DataSourceClass: function () {
        return api;
      } as unknown as TestDataSourcePlugin['DataSourceClass'],
      components: api.components ?? {},
    };
  };
}

/**
 * Minimal legacy service for the call sites a test reaches that are not migrated yet. It resolves
 * by uid or name and falls back to the default data source for an empty ref. getList ignores its
 * filters — the async list API applies the real ones.
 */
function createLegacyDataSourceSrvMock(fixtures: DataSourceFixture[], defaultDataSourceName: string): DataSourceSrv {
  const byUid = keyBy(fixtures, (fixture) => fixture.settings.uid);
  const byName = keyBy(fixtures, (fixture) => fixture.settings.name);

  const find = (ref?: DataSourceRef | string | null): DataSourceFixture | undefined => {
    const nameOrUid = typeof ref === 'string' ? ref : ref?.uid;
    if (!nameOrUid || nameOrUid === 'default') {
      return byUid[defaultDataSourceName] ?? byName[defaultDataSourceName];
    }
    return byUid[nameOrUid] ?? byName[nameOrUid];
  };

  return {
    get(ref) {
      const fixture = find(ref);
      if (!fixture?.api) {
        return Promise.reject(new Error(`Datasource ${JSON.stringify(ref)} was not found`));
      }
      return Promise.resolve(fixture.api);
    },
    getInstanceSettings(ref) {
      return find(ref)?.settings;
    },
    getList() {
      return fixtures.map((fixture) => fixture.settings);
    },
    reload: jest.fn().mockResolvedValue(undefined),
    registerRuntimeDataSource: jest.fn(),
  };
}

const DATA_SOURCE_LOGGER_SOURCE = 'grafana/runtime.plugins.datasource';

const FALLBACK_WARNINGS = {
  instance: FALLBACK_TO_LEGACY_INSTANCE_WARNING,
  settings: FALLBACK_TO_LEGACY_SETTINGS_WARNING,
  list: FALLBACK_TO_LEGACY_LIST_WARNING,
} as const;

type DataSourceFallbackKind = keyof typeof FALLBACK_WARNINGS;

export interface DataSourceFallbackWatcher {
  /** Throws if any of the given kinds of fallback happened. Instance resolution by default. */
  expectNoFallbacks(kinds?: DataSourceFallbackKind[]): void;
}

/**
 * Watch for data source lookups that resolved through the legacy `DataSourceSrv` fallback.
 *
 * The fallback logs a warning, but that warning is inert in `public/app` suites: nothing calls
 * `initializeLoggersRegistry` there, so it never reaches the console and jest-fail-on-console
 * never sees it. Absence of console output proves nothing — register this spy logger instead.
 */
export function watchDataSourceFallbacks(): DataSourceFallbackWatcher {
  const logger = mockLogger(DATA_SOURCE_LOGGER_SOURCE);

  return {
    expectNoFallbacks(kinds = ['instance']) {
      const messages: string[] = kinds.map((kind) => FALLBACK_WARNINGS[kind]);
      const fallbacks = jest
        .mocked(logger.logWarning)
        .mock.calls.map(([message]) => message)
        .filter((message) => messages.includes(message));

      if (fallbacks.length > 0) {
        throw new Error(
          `Data sources resolved through the legacy DataSourceSrv fallback, so this test asserts legacy semantics. ` +
            `Seed the async APIs too (seedDataSources).\n${fallbacks.map((message) => `  - ${message}`).join('\n')}`
        );
      }
    },
  };
}
