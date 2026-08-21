import { getDataSourceInstance } from '@grafana/runtime/unstable';
import { SceneQueryRunner, SceneVariableSet, TestVariable, VizPanel } from '@grafana/scenes';
import { type DataQuery } from '@grafana/schema';

import { buildPanelElementFromDashboard } from './buildPanelElementFromDashboard';

const interpolateVariablesInQueries = jest.fn();

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstance: jest.fn(),
}));

const getDataSourceInstanceMock = jest.mocked(getDataSourceInstance);

/** A panel whose query names a variable, inside a scene that defines it. */
function buildPanel(queries: DataQuery[], title = 'CPU', description?: string) {
  return new VizPanel({
    key: 'panel-1',
    title,
    description,
    pluginId: 'timeseries',
    $variables: new SceneVariableSet({
      variables: [new TestVariable({ name: 'service', value: 'checkout', text: 'checkout', query: 'A' })],
    }),
    $data: new SceneQueryRunner({ datasource: { uid: 'prom' }, queries }),
  });
}

describe('buildPanelElementFromDashboard', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- only interpolation is read
    getDataSourceInstanceMock.mockResolvedValue({ interpolateVariablesInQueries } as unknown as Awaited<
      ReturnType<typeof getDataSourceInstance>
    >);
    // By default, stand in for a datasource that resolves `$service` to its current value.
    interpolateVariablesInQueries.mockImplementation((queries: DataQuery[]) =>
      queries.map((query) => ({ ...query, expr: String(Reflect.get(query, 'expr')).replace('$service', 'checkout') }))
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

  // Prose rather than a query, so this is cosmetic rather than wrong data - but a notebook has no
  // variables, so the reader would be shown a name that means nothing there.
  it('interpolates the description, so the cell does not explain itself with a variable name', async () => {
    const element = await buildPanelElementFromDashboard(
      buildPanel([{ refId: 'A' }], 'CPU', 'Errors seen by $service')
    );

    expect(element.kind === 'Panel' && element.spec.description).toBe('Errors seen by checkout');
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a datasource with no interpolation
    getDataSourceInstanceMock.mockResolvedValueOnce({} as unknown as Awaited<ReturnType<typeof getDataSourceInstance>>);

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
});
