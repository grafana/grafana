import { getDataSourceInstance } from '@grafana/runtime/unstable';
import {
  CustomVariable,
  type SceneObject,
  SceneQueryRunner,
  SceneTimeRange,
  type SceneVariable,
  SceneVariableSet,
  TestVariable,
  VizPanel,
} from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';
import { LibraryPanelBehavior } from 'app/features/dashboard-scene/scene/LibraryPanelBehavior';

import { buildPanelElementFromDashboard } from './buildPanelElementFromDashboard';

const interpolateVariablesInQueries = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);

/** A panel whose query names a variable, inside a scene that defines it. */
function buildPanel(
  queries: DataQuery[],
  title = 'CPU',
  description?: string,
  extra: {
    datasource?: DataQuery['datasource'];
    behaviors?: SceneObject[];
    variables?: SceneVariable[];
    timeRange?: SceneTimeRange;
  } = {}
) {
  return new VizPanel({
    key: 'panel-1',
    title,
    description,
    pluginId: 'timeseries',
    $behaviors: extra.behaviors,
    $timeRange: extra.timeRange,
    $variables: new SceneVariableSet({
      variables: extra.variables ?? [
        new TestVariable({ name: 'service', value: 'checkout', text: 'checkout', query: 'A' }),
      ],
    }),
    $data: new SceneQueryRunner({ datasource: extra.datasource ?? { uid: 'prom' }, queries }),
  });
}

/**
 * A datasource stand-in. `getRef` and `meta` are what the write-back reads; a real DataSourceApi
 * always carries both.
 */
function datasourceApi(overrides: Partial<Record<string, unknown>> = {}) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only these three are read
  return {
    getRef: () => ({ type: 'prometheus', uid: 'prom' }),
    meta: { mixed: false },
    interpolateVariablesInQueries,
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof getDataSourceInstance>>;
}

describe('buildPanelElementFromDashboard', () => {
  beforeEach(() => {
    getDataSourceInstanceMock.mockResolvedValue(datasourceApi());
    // Stands in for a datasource that resolves everything templateSrv can — the dashboard's variables
    // *and* its time macros. The macros reaching a query untouched is therefore a real result rather
    // than a mock that never tried.
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) =>
      queries.map((query) => ({
        ...query,
        expr: String(Reflect.get(query, 'expr') ?? '')
          .replace('$service', 'checkout')
          .replace(/\$__from\b/g, '1700000000000')
          .replace(/\$__to\b/g, '1700003600000')
          .replace(/\$__interval\b/g, '30s')
          // Scenes has no macro for these two, so nothing rewrites them today. The mock tries anyway,
          // or the assertion below would hold against a datasource that never attempted them.
          .replace(/\$__range\b/g, '3600s')
          .replace(/\$__rate_interval\b/g, '2m'),
      }))
    );
  });

  afterEach(() => jest.clearAllMocks());

  // The notebook has no variables of its own, so a query still saying `$service` there resolves to
  // nothing and quietly returns the wrong data.
  it('interpolates variable references out of the queries', async () => {
    const element = await buildPanelElementFromDashboard(
      buildPanel([{ refId: 'A', ...{ expr: 'rate(errors{job="$service"}[5m])' } }])
    );

    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
      expr: 'rate(errors{job="checkout"}[5m])',
    });
  });

  it('interpolates the title too, so the cell is not labelled with a variable name', async () => {
    const element = await buildPanelElementFromDashboard(buildPanel([{ refId: 'A' }], 'Errors for $service'));

    expect(element.kind === 'Panel' && element.spec.title).toBe('Errors for checkout');
  });

  // The title is what VizPanelRenderer shows, and it renders with the `text` format - so a variable
  // whose label differs from its value would otherwise be captured as something the reader never saw.
  it('captures the label a variable displayed in the title, not the value behind it', async () => {
    const element = await buildPanelElementFromDashboard(
      buildPanel([{ refId: 'A' }], 'Errors for $service', undefined, {
        variables: [
          new CustomVariable({
            name: 'service',
            query: 'Checkout Service : checkout-svc',
            value: 'checkout-svc',
            text: 'Checkout Service',
          }),
        ],
      })
    );

    expect(element.kind === 'Panel' && element.spec.title).toBe('Errors for Checkout Service');
  });

  // Prose rather than a query, so this is cosmetic rather than wrong data - but a notebook has no
  // variables, so the reader would be shown a name that means nothing there.
  it('interpolates the description, so the cell does not explain itself with a variable name', async () => {
    const element = await buildPanelElementFromDashboard(
      buildPanel([{ refId: 'A' }], 'CPU', 'Errors seen by $service')
    );

    expect(element.kind === 'Panel' && element.spec.description).toBe('Errors seen by checkout');
  });

  // Panel text names a window as much as a query does, and the notebook has its own picker. Frozen
  // here, a title would go on naming the dashboard's range however the reader moves the notebook's.
  it('leaves the time macros in the title and description for the notebook to resolve', async () => {
    const element = await buildPanelElementFromDashboard(
      buildPanel([{ refId: 'A' }], 'Errors for $service since $__from', 'Up to $__to, binned by $__interval', {
        timeRange: new SceneTimeRange({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' }),
      })
    );

    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    // The variable beside them still resolves: it is the macros alone that are held back.
    expect(element.spec.title).toBe('Errors for checkout since $__from');
    expect(element.spec.description).toBe('Up to $__to, binned by $__interval');
  });

  // Interpolating means rewriting queries, and the user is still looking at the dashboard it came from.
  it('leaves the source panel untouched', async () => {
    const panel = buildPanel([{ refId: 'A', ...{ expr: 'up{job="$service"}' } }]);

    await buildPanelElementFromDashboard(panel);

    const runner = panel.state.$data;
    expect(runner instanceof SceneQueryRunner && runner.state.queries[0]).toMatchObject({
      expr: 'up{job="$service"}',
    });
  });

  /**
   * Interpolation is optional on DataSourceApi, so this stands in for a datasource that does not
   * implement it at all - the method absent, not present and returning nothing. Asserted on the query
   * that came out rather than on how many, because a count survives the query being replaced wholesale.
   */
  it('keeps the queries as they are when the datasource cannot interpolate', async () => {
    getDataSourceInstanceMock.mockResolvedValueOnce(datasourceApi({ interpolateVariablesInQueries: undefined }));

    const element = await buildPanelElementFromDashboard(buildPanel([{ refId: 'A', ...{ expr: 'up' } }]));

    if (element.kind !== 'Panel') {
      throw new Error('expected a Panel element');
    }
    expect(element.spec.data.spec.queries).toHaveLength(1);
    expect(element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({ expr: 'up' });
  });

  // Same again for a datasource that cannot be resolved at all: no interpolation, but the panel still
  // crosses over intact.
  it('keeps the queries as they are when the datasource cannot be resolved', async () => {
    getDataSourceInstanceMock.mockRejectedValueOnce(new Error('no such datasource'));

    const element = await buildPanelElementFromDashboard(buildPanel([{ refId: 'A', ...{ expr: 'up' } }]));

    expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
      expr: 'up',
    });
  });

  /**
   * A datasource that throws while interpolating is not the same as one that cannot interpolate. The
   * query it would have rewritten is the one thing this function exists to rewrite, so filing the raw
   * version and reporting success would be worse than failing the add outright.
   */
  it('fails the add rather than storing an un-interpolated query', async () => {
    interpolateVariablesInQueries.mockImplementation(() => {
      throw new Error('interpolation blew up');
    });

    await expect(
      buildPanelElementFromDashboard(buildPanel([{ refId: 'A', ...{ expr: 'up{job="$service"}' } }]))
    ).rejects.toThrow('interpolation blew up');
  });
  /**
   * getPersistedDSFor gives the panel's datasource precedence over a query's own, except on a mixed
   * panel where each query keeps its own. So the two write-backs below are load-bearing in different
   * cases, and each is tested through the case where it is the one that decides.
   */
  describe('the datasource', () => {
    function resolvesTo(byUid: Record<string, { uid: string; type: string; mixed?: boolean }>) {
      getDataSourceInstanceMock.mockImplementation(async (ref) => {
        const uid = (typeof ref === 'string' ? ref : ref?.uid) ?? '';
        const resolved = byUid[uid] ?? { uid, type: 'prometheus' };
        return datasourceApi({
          meta: { mixed: Boolean(resolved.mixed) },
          getRef: () => ({ type: resolved.type, uid: resolved.uid }),
        });
      });
    }

    it('is looked up with the panel scope, so a variable reference can resolve', async () => {
      await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', ...{ expr: 'up' } }], 'CPU', undefined, { datasource: { uid: '${datasource}' } })
      );

      const scopes = getDataSourceInstanceMock.mock.calls.map(([, scopedVars]) => scopedVars);
      expect(scopes).not.toHaveLength(0);
      expect(scopes.every((scope) => scope?.__sceneObject !== undefined)).toBe(true);
    });

    it('is written back to the panel, which is what an ordinary panel serializes', async () => {
      resolvesTo({ '${datasource}': { uid: 'prom-eu', type: 'prometheus' } });

      const element = await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', ...{ expr: 'up' } }], 'CPU', undefined, { datasource: { uid: '${datasource}' } })
      );

      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.datasource).toEqual({
        name: 'prom-eu',
      });
    });

    // A mixed panel is where the panel's datasource does not stand in for its queries.
    it('is written back to each query of a mixed panel, which serializes them one by one', async () => {
      resolvesTo({
        '-- Mixed --': { uid: '-- Mixed --', type: 'datasource', mixed: true },
        '${queryDatasource}': { uid: 'loki-1', type: 'loki' },
      });

      const element = await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', datasource: { uid: '${queryDatasource}' }, ...{ expr: 'up' } }], 'CPU', undefined, {
          datasource: { uid: '-- Mixed --' },
        })
      );

      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.datasource).toEqual({
        name: 'loki-1',
      });
    });

    it('is not stamped onto a query when it resolves to mixed', async () => {
      resolvesTo({ '-- Mixed --': { uid: '-- Mixed --', type: 'datasource', mixed: true } });

      const element = await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', ...{ expr: 'up' } }], 'CPU', undefined, { datasource: { uid: '-- Mixed --' } })
      );

      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.datasource).toBeUndefined();
    });
  });

  // Freezing these would leave the panel re-running the dashboard's window while the notebook's Time
  // row claimed otherwise. Explore can freeze them; it opens on the range it was handed.
  describe('the Grafana time macros', () => {
    it('stay dynamic, so the panel follows whatever range the notebook is on', async () => {
      const expr = 'rate(errors{job="$service"}[$__interval]) $__from $__to $__range $__rate_interval';
      const element = await buildPanelElementFromDashboard(buildPanel([{ refId: 'A', ...{ expr } }]));

      // `$service` still resolved — that is what this function exists for.
      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
        expr: 'rate(errors{job="checkout"}[$__interval]) $__from $__to $__range $__rate_interval',
      });
    });

    // Rules out shadowing through scopedVars: the format suffix would still apply to the shadow.
    it('survive whole when a format suffix is attached', async () => {
      const element = await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', ...{ expr: "SELECT * FROM m WHERE t > '$__from:date:iso'" } }])
      );

      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
        expr: "SELECT * FROM m WHERE t > '$__from:date:iso'",
      });
    });

    it('tell $__interval_ms apart from $__interval', async () => {
      const element = await buildPanelElementFromDashboard(
        buildPanel([{ refId: 'A', ...{ expr: 'sum(x) / $__interval_ms' } }])
      );

      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
        expr: 'sum(x) / $__interval_ms',
      });
    });
  });

  describe('library panels', () => {
    function libraryPanel(isLoaded: boolean) {
      return buildPanel([{ refId: 'A', ...{ expr: 'up{job="$service"}' } }], 'Shared CPU', undefined, {
        behaviors: [new LibraryPanelBehavior({ uid: 'lp-1', name: 'shared-cpu', isLoaded })],
      });
    }

    it('are inlined, so the interpolation is not thrown away', async () => {
      const element = await buildPanelElementFromDashboard(libraryPanel(true));

      expect(element.kind).toBe('Panel');
      expect(element.kind === 'Panel' && element.spec.data.spec.queries[0].spec.query.spec).toMatchObject({
        expr: 'up{job="checkout"}',
      });
    });

    // Nothing has written the library panel's model on yet, so inlining would store an empty panel.
    it('keep the reference while the library panel is still loading', async () => {
      const element = await buildPanelElementFromDashboard(libraryPanel(false));

      expect(element.kind).toBe('LibraryPanel');
    });
  });
});
