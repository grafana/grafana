import { PromVariableQueryType } from '@grafana/prometheus';
import {
  QueryVariable,
  SceneQueryRunner,
  SceneVariableSet,
  type SceneVariable,
  VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { type DashboardGridItem } from '../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';

import { detectMigratableVariables, getPromLabelQueryKind } from './detect';

const instanceSettingsMap: Record<string, { uid: string; type: string }> = {
  'prom-a': { uid: 'prom-a', type: 'prometheus' },
  'prom-b': { uid: 'prom-b', type: 'prometheus' },
  'loki-a': { uid: 'loki-a', type: 'loki' },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: DataSourceRef | string | null | undefined) => {
      const uid = typeof ref === 'string' ? ref : ref?.uid;
      return uid === undefined ? instanceSettingsMap['prom-a'] : instanceSettingsMap[uid];
    },
  }),
}));

interface PanelSpec {
  queries: Array<Record<string, unknown>>;
  datasourceUid?: string;
  title?: string;
}

function buildDashboard(variables: SceneVariable[], panels: PanelSpec[]): DashboardScene {
  const vizPanels = panels.map(
    (panel, index) =>
      new VizPanel({
        key: `panel-${index + 1}`,
        title: panel.title ?? `Panel ${index + 1}`,
        pluginId: 'timeseries',
        $data: new SceneQueryRunner({
          datasource: { uid: panel.datasourceUid ?? 'prom-a' },
          queries: panel.queries.map((query, queryIndex) => ({ refId: String.fromCharCode(65 + queryIndex), ...query })),
        }),
      })
  );

  return new DashboardScene({
    title: 'Detection test dashboard',
    uid: 'detection-test',
    $variables: new SceneVariableSet({ variables }),
    body: DefaultGridLayoutManager.fromVizPanels(vizPanels),
  });
}

function promLabelVariable(name: string, overrides: Partial<ConstructorParameters<typeof QueryVariable>[0]> = {}) {
  return new QueryVariable({
    name,
    datasource: { uid: 'prom-a', type: 'prometheus' },
    query: `label_values(up, ${name})`,
    value: `${name}-value`,
    ...overrides,
  });
}

describe('getPromLabelQueryKind', () => {
  it.each([
    ['label_names()', 'labelNames'],
    ['label_values(instance)', 'labelValues'],
    ['label_values(up, instance)', 'labelValues'],
    ['label_values(up{job="grafana"}, instance)', 'labelValues'],
    ['metrics(.*)', undefined],
    ['query_result(up)', undefined],
    ['up', undefined],
  ])('recognizes the legacy string form %s as %s', (query, expected) => {
    expect(getPromLabelQueryKind(query)).toBe(expected);
  });

  it('recognizes structured qryType queries', () => {
    expect(getPromLabelQueryKind({ refId: 'A', qryType: PromVariableQueryType.LabelNames })).toBe('labelNames');
    expect(getPromLabelQueryKind({ refId: 'A', qryType: PromVariableQueryType.LabelValues, label: 'instance' })).toBe(
      'labelValues'
    );
    expect(getPromLabelQueryKind({ refId: 'A', qryType: PromVariableQueryType.MetricNames })).toBeUndefined();
  });

  it('recognizes the migrated {query} and {expr} forms', () => {
    expect(getPromLabelQueryKind({ refId: 'A', query: 'label_values(up, instance)' })).toBe('labelValues');
    expect(getPromLabelQueryKind({ refId: 'A', expr: 'label_names()' })).toBe('labelNames');
    expect(getPromLabelQueryKind({ refId: 'A', query: 'up' })).toBeUndefined();
  });
});

describe('detectMigratableVariables', () => {
  it('detects filter variables in matcher positions (legacy string and structured forms)', () => {
    const dashboard = buildDashboard(
      [
        promLabelVariable('instance'),
        promLabelVariable('job', {
          query: { refId: 'PrometheusVariableQueryEditor-VariableQuery', qryType: 1, label: 'job' },
        }),
      ],
      [
        { queries: [{ expr: 'sum(rate(up{instance=~"$instance", job=~"$job"}[5m]))' }] },
        { queries: [{ expr: 'up{instance="$instance"}' }] },
      ]
    );

    const candidates = detectMigratableVariables(dashboard);

    expect(candidates).toHaveLength(2);

    const [instance, job] = candidates;
    expect(instance).toMatchObject({
      variableName: 'instance',
      datasourceUid: 'prom-a',
      labelQueryKind: 'labelValues',
      kind: 'filter',
      filterKey: 'instance',
      filterOperators: ['=', '=~'],
      queryCount: 2,
      currentValue: 'instance-value',
      disqualified: false,
      reasons: [],
    });
    expect(job).toMatchObject({
      variableName: 'job',
      kind: 'filter',
      filterKey: 'job',
      filterOperators: ['=~'],
      queryCount: 1,
      disqualified: false,
    });
  });

  it('detects groupBy variables and mixed usage', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('groupby', { query: 'label_names()' }), promLabelVariable('instance')],
      [{ queries: [{ expr: 'sum by($groupby) (rate(up{instance=~"$instance"}[5m]))' }] }]
    );

    const [groupby, instance] = detectMigratableVariables(dashboard);

    expect(groupby).toMatchObject({ kind: 'groupBy', labelQueryKind: 'labelNames', disqualified: false });
    expect(groupby.filterKey).toBeUndefined();
    expect(instance).toMatchObject({ kind: 'filter', filterKey: 'instance', disqualified: false });
  });

  it('detects variables used both as filter and groupBy', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('pod')],
      [{ queries: [{ expr: 'sum by($pod) (up{pod=~"$pod"})' }] }]
    );

    expect(detectMigratableVariables(dashboard)[0]).toMatchObject({ kind: 'both', disqualified: false });
  });

  it('disqualifies variables interpolated in unsafe positions', () => {
    const dashboard = buildDashboard([promLabelVariable('metric')], [{ queries: [{ expr: 'rate($metric[5m])' }] }]);

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'unsafe-position' }));
  });

  it('disqualifies variables used in queries of another datasource', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance')],
      [
        { queries: [{ expr: 'up{instance=~"$instance"}' }] },
        { datasourceUid: 'prom-b', queries: [{ expr: 'up{instance=~"$instance"}' }] },
      ]
    );

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'cross-datasource-usage' }));
  });

  it('disqualifies variables whose datasource ref is a datasource variable', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance', { datasource: { uid: '${ds}', type: 'prometheus' } })],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'datasource-variable-ref' }));
  });

  it('disqualifies variables used for panel repeat', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('pod')],
      [{ queries: [{ expr: 'up{pod=~"$pod"}' }] }]
    );

    const layout = dashboard.state.body;
    if (!(layout instanceof DefaultGridLayoutManager)) {
      throw new Error('expected default grid layout');
    }
    const gridItem: DashboardGridItem = layout.state.grid.state.children[0] as DashboardGridItem;
    gridItem.setState({ variableName: 'pod' });

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'panel-repeat' }));
  });

  it('disqualifies variables referenced outside queries (panel title)', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance')],
      [{ title: 'CPU on $instance', queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'referenced-outside-queries' }));
  });

  it('disqualifies variables referenced in another variable query', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('job'), promLabelVariable('instance', { query: 'label_values(up{job="$job"}, instance)' })],
      [{ queries: [{ expr: 'up{job=~"$job", instance=~"$instance"}' }] }]
    );

    const [job, instance] = detectMigratableVariables(dashboard);

    expect(job.disqualified).toBe(true);
    expect(job.reasons).toContainEqual(expect.objectContaining({ code: 'referenced-outside-queries' }));
    expect(instance.disqualified).toBe(false);
  });

  it('disqualifies variables not used in any panel query', () => {
    const dashboard = buildDashboard([promLabelVariable('unused')], [{ queries: [{ expr: 'up' }] }]);

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(expect.objectContaining({ code: 'not-used-in-queries' }));
  });

  it('disqualifies variables with ambiguous filter keys', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('target')],
      [{ queries: [{ expr: 'up{instance=~"$target"} and up{host=~"$target"}' }] }]
    );

    const [candidate] = detectMigratableVariables(dashboard);

    expect(candidate.disqualified).toBe(true);
    expect(candidate.reasons).toContainEqual(
      expect.objectContaining({ code: 'ambiguous-filter-key', detail: 'host, instance' })
    );
    expect(candidate.filterKey).toBeUndefined();
  });

  it('ignores variables on non-Prometheus datasources', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance', { datasource: { uid: 'loki-a', type: 'loki' } })],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    expect(detectMigratableVariables(dashboard)).toHaveLength(0);
  });

  it('ignores non-label Prometheus query variables', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('metric', { query: 'metrics(.*)' })],
      [{ queries: [{ expr: 'up' }] }]
    );

    expect(detectMigratableVariables(dashboard)).toHaveLength(0);
  });

  it('does not mutate the scene or mark it dirty', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance')],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    detectMigratableVariables(dashboard);

    expect(dashboard.state.isDirty).toBeFalsy();
  });
});
