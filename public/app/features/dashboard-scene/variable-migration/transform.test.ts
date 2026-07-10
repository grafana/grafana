import {
  AdHocFiltersVariable,
  QueryVariable,
  SceneQueryRunner,
  SceneVariableSet,
  type SceneVariable,
  VizPanel,
} from '@grafana/scenes';
import { type DataSourceRef } from '@grafana/schema';

import { DashboardScene } from '../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../scene/layout-default/DefaultGridLayoutManager';
import { getQueryRunnerFor } from '../utils/utils';

import { detectMigratableVariables } from './detect';
import { applyVariableMigration } from './transform';

const instanceSettingsMap: Record<string, { uid: string; type: string; meta: { multiValueFilterOperators: boolean } }> =
  {
    'prom-a': { uid: 'prom-a', type: 'prometheus', meta: { multiValueFilterOperators: true } },
    'prom-b': { uid: 'prom-b', type: 'prometheus', meta: { multiValueFilterOperators: true } },
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
          queries: panel.queries.map((query, queryIndex) => ({
            refId: String.fromCharCode(65 + queryIndex),
            ...query,
          })),
        }),
      })
  );

  return new DashboardScene({
    title: 'Transform test dashboard',
    uid: 'transform-test',
    // Avoids onEnterEditMode, which needs the full page/edit-pane machinery in tests
    isEditing: true,
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

function getVariableNames(dashboard: DashboardScene): string[] {
  return dashboard.state.$variables!.state.variables.map((variable) => variable.state.name);
}

function getAdHocVariables(dashboard: DashboardScene): AdHocFiltersVariable[] {
  return dashboard.state.$variables!.state.variables.filter(
    (variable): variable is AdHocFiltersVariable => variable instanceof AdHocFiltersVariable
  );
}

function getPanelExprs(dashboard: DashboardScene): string[] {
  return dashboard
    .getDashboardPanels()
    .map((panel) => getQueryRunnerFor(panel)!.state.queries.map((query) => String(query.expr)))
    .flat();
}

function applyDetected(dashboard: DashboardScene) {
  return applyVariableMigration(dashboard, detectMigratableVariables(dashboard));
}

describe('applyVariableMigration', () => {
  it('migrates filter variables: adhoc created, filters seeded, exprs cleaned, variables removed', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance'), promLabelVariable('job')],
      [
        { queries: [{ expr: 'sum(rate(up{instance=~"$instance", job="$job"}[5m]))' }] },
        { queries: [{ expr: 'up{instance=~"$instance"}' }] },
      ]
    );

    const result = applyDetected(dashboard);

    expect(result.migratedVariableNames.sort()).toEqual(['instance', 'job']);
    expect(getVariableNames(dashboard)).toEqual(['filter0']);

    const [adHoc] = getAdHocVariables(dashboard);
    expect(adHoc.state.datasource).toEqual({ uid: 'prom-a', type: 'prometheus' });
    expect(adHoc.state.applyMode).toBe('auto');
    expect(adHoc.state.filters).toEqual([
      { key: 'instance', operator: '=~', value: 'instance-value' },
      { key: 'job', operator: '=', value: 'job-value' },
    ]);

    expect(getPanelExprs(dashboard)).toEqual(['sum(rate(up[5m]))', 'up']);
  });

  it('seeds a one-of filter for multi-value current values', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance', { value: ['server-1', 'server-2'] })],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    applyDetected(dashboard);

    expect(getAdHocVariables(dashboard)[0].state.filters).toEqual([
      {
        key: 'instance',
        operator: '=|',
        value: 'server-1',
        values: ['server-1', 'server-2'],
        valueLabels: ['server-1', 'server-2'],
      },
    ]);
  });

  it('seeds no filter when the current value is All', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance', { value: '$__all', text: 'All' })],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    const result = applyDetected(dashboard);

    expect(result.migratedVariableNames).toEqual(['instance']);
    expect(getAdHocVariables(dashboard)[0].state.filters).toEqual([]);
    expect(getPanelExprs(dashboard)).toEqual(['up']);
  });

  it('migrates groupBy variables: enableGroupBy set, groupBy entry seeded, by(...) cleaned', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('groupby', { query: 'label_names()', value: 'pod' }), promLabelVariable('instance')],
      [{ queries: [{ expr: 'sum by($groupby) (rate(up{instance=~"$instance"}[5m]))' }] }]
    );

    applyDetected(dashboard);

    const [adHoc] = getAdHocVariables(dashboard);
    expect(adHoc.state.enableGroupBy).toBe(true);
    // Seeds follow the variable declaration order: groupby first, then instance
    expect(adHoc.state.filters).toEqual([
      { key: 'pod', operator: 'groupBy', value: '', condition: '' },
      { key: 'instance', operator: '=~', value: 'instance-value' },
    ]);

    expect(getPanelExprs(dashboard)).toEqual(['sum (rate(up[5m]))']);
  });

  it('keeps other grouping labels in by(...)', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('groupby', { query: 'label_names()', value: 'pod' })],
      [{ queries: [{ expr: 'sum by($groupby, job) (up)' }] }]
    );

    applyDetected(dashboard);

    expect(getPanelExprs(dashboard)).toEqual(['sum by(job) (up)']);
  });

  it('reuses an existing adhoc variable for the same datasource', () => {
    const existing = new AdHocFiltersVariable({
      name: 'existing-filters',
      datasource: { uid: 'prom-a', type: 'prometheus' },
      applyMode: 'auto',
      filters: [{ key: 'env', operator: '=', value: 'prod' }],
    });
    const dashboard = buildDashboard(
      [existing, promLabelVariable('instance')],
      [{ queries: [{ expr: 'up{instance=~"$instance"}' }] }]
    );

    const result = applyDetected(dashboard);

    expect(result.adHocVariables).toEqual([existing]);
    expect(getVariableNames(dashboard)).toEqual(['existing-filters']);
    expect(existing.state.filters).toEqual([
      { key: 'env', operator: '=', value: 'prod' },
      { key: 'instance', operator: '=~', value: 'instance-value' },
    ]);
  });

  it('creates one adhoc variable per datasource', () => {
    const dashboard = buildDashboard(
      [
        promLabelVariable('instance'),
        promLabelVariable('cluster', { datasource: { uid: 'prom-b', type: 'prometheus' } }),
      ],
      [
        { queries: [{ expr: 'up{instance=~"$instance"}' }] },
        { datasourceUid: 'prom-b', queries: [{ expr: 'up{cluster=~"$cluster"}' }] },
      ]
    );

    const result = applyDetected(dashboard);

    expect(result.adHocVariables).toHaveLength(2);
    const [adHocA, adHocB] = getAdHocVariables(dashboard);
    expect(adHocA.state.datasource?.uid).toBe('prom-a');
    expect(adHocA.state.filters).toEqual([{ key: 'instance', operator: '=~', value: 'instance-value' }]);
    expect(adHocB.state.datasource?.uid).toBe('prom-b');
    expect(adHocB.state.filters).toEqual([{ key: 'cluster', operator: '=~', value: 'cluster-value' }]);
    expect(getPanelExprs(dashboard)).toEqual(['up', 'up']);
  });

  it('migrates a safe variable used alongside a disqualified one in the same expr', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance'), promLabelVariable('metric')],
      [{ queries: [{ expr: 'rate($metric{instance=~"$instance"}[5m])' }] }]
    );

    const result = applyDetected(dashboard);

    // `$metric` sits in metric-name position (unsafe), `$instance` in a matcher (safe)
    expect(result.migratedVariableNames).toEqual(['instance']);
    expect(getVariableNames(dashboard)).toEqual(['metric', 'filter0']);
    expect(getPanelExprs(dashboard)).toEqual(['rate($metric[5m])']);
  });

  it('migrates safe variables while leaving disqualified ones in place', () => {
    const dashboard = buildDashboard(
      [promLabelVariable('instance'), promLabelVariable('title', { query: 'label_names()' })],
      [
        { queries: [{ expr: 'up{instance=~"$instance"}' }] },
        { queries: [{ expr: 'sum by($title) (up)' }], title: 'About $title' },
      ]
    );

    const result = applyDetected(dashboard);

    expect(result.migratedVariableNames).toEqual(['instance']);
    expect(getVariableNames(dashboard)).toEqual(['title', 'filter0']);
    expect(getPanelExprs(dashboard)).toEqual(['up', 'sum by($title) (up)']);
  });

  it('returns without changes when nothing is selected', () => {
    const dashboard = buildDashboard([promLabelVariable('unused')], [{ queries: [{ expr: 'up' }] }]);

    const result = applyDetected(dashboard);

    expect(result).toEqual({ migratedVariableNames: [], adHocVariables: [] });
    expect(getVariableNames(dashboard)).toEqual(['unused']);
  });
});
