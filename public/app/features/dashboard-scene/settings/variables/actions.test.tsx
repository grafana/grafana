import { CustomVariable, sceneGraph, SceneGridLayout, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';
import { RowsLayoutManager } from '../../scene/layout-rows/RowsLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { openAddSectionVariablePane, openAddVariablePane, collectDescendantVariables } from './actions';

const defaultDsSettings = {
  name: 'TestDataSource',
  uid: 'ds1',
  type: 'test',
  meta: { id: 'test', name: 'Test' },
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getInstanceSettings: (ref: string | null) => (ref === null ? defaultDsSettings : undefined),
  }),
}));

function buildDashboardScene() {
  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(dashboard);
  return dashboard;
}

function buildSectionScene(options?: { dashboardVariables?: CustomVariable[]; sectionVariables?: CustomVariable[] }) {
  const row = new RowItem({
    title: 'Row 1',
    $variables: options?.sectionVariables ? new SceneVariableSet({ variables: options.sectionVariables }) : undefined,
  });

  const dashboard = new DashboardScene({
    $variables: new SceneVariableSet({ variables: options?.dashboardVariables ?? [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new RowsLayoutManager({
      rows: [row],
    }),
  });

  activateFullSceneTree(dashboard);

  return { dashboard, row };
}

describe('variable actions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds a default dashboard query variable, selects it, and tracks the query type', () => {
    const dashboard = buildDashboardScene();
    const newVariableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'newVariableTypeSelected');
    const variablesSet = sceneGraph.getVariables(dashboard) as SceneVariableSet;

    openAddVariablePane(dashboard);

    expect(variablesSet.state.variables).toHaveLength(1);
    expect(variablesSet.state.variables[0].state.name).toBe('query0');
    expect(variablesSet.state.variables[0].state.type).toBe('query');
    expect(dashboard.state.editPane.getSelection()).toBe(variablesSet.state.variables[0]);
    expect(newVariableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });

  it('avoids dashboard variable name collisions with section variables', () => {
    const { dashboard } = buildSectionScene({
      sectionVariables: [new CustomVariable({ name: 'query0', query: 'c,d', value: ['c'], text: ['c'] })],
    });
    const variablesSet = sceneGraph.getVariables(dashboard) as SceneVariableSet;

    openAddVariablePane(dashboard);

    expect(variablesSet.state.variables).toHaveLength(1);
    expect(variablesSet.state.variables[0].state.name).toBe('query1');
    expect(variablesSet.state.variables[0].state.type).toBe('query');
  });

  it('adds a default section query variable directly and tracks the section query type', () => {
    const { dashboard, row } = buildSectionScene();
    const newSectionVariableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'newSectionVariableTypeSelected');

    openAddSectionVariablePane(dashboard, row);

    expect(row.state.$variables).toBeInstanceOf(SceneVariableSet);
    const sectionVariables = (row.state.$variables as SceneVariableSet).state.variables;
    expect(sectionVariables).toHaveLength(1);
    expect(sectionVariables[0].state.name).toBe('query0');
    expect(sectionVariables[0].state.type).toBe('query');
    expect(dashboard.state.editPane.getSelection()).toBe(sectionVariables[0]);
    expect(newSectionVariableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });

  it('avoids section variable name collisions with dashboard and section variables', () => {
    const { dashboard, row } = buildSectionScene({
      dashboardVariables: [new CustomVariable({ name: 'query0', query: 'a,b', value: ['a'], text: ['a'] })],
      sectionVariables: [new CustomVariable({ name: 'query1', query: 'c,d', value: ['c'], text: ['c'] })],
    });

    openAddSectionVariablePane(dashboard, row);

    const sectionVariables = (row.state.$variables as SceneVariableSet).state.variables;
    expect(sectionVariables).toHaveLength(2);
    expect(sectionVariables[1].state.name).toBe('query2');
    expect(sectionVariables[1].state.type).toBe('query');
  });
});

describe('collectDescendantVariables', () => {
  it('returns an empty array when there are no descendant variable sets', () => {
    const dashboard = buildDashboardScene();
    expect(collectDescendantVariables(dashboard)).toEqual([]);
  });

  it('collects variables from row section variable sets', () => {
    const { dashboard } = buildSectionScene({
      sectionVariables: [new CustomVariable({ name: 'custom0', query: 'a,b,c' })],
    });
    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(1);
    expect(result[0].state.name).toBe('custom0');
  });

  it('collects variables from multiple rows', () => {
    const sectionVar1 = new CustomVariable({ name: 'custom0', query: 'a,b' });
    const sectionVar2 = new CustomVariable({ name: 'custom1', query: 'c,d' });
    const dashboard = new DashboardScene({
      $variables: new SceneVariableSet({ variables: [] }),
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      isEditing: true,
      body: new RowsLayoutManager({
        rows: [
          new RowItem({
            title: 'Row 1',
            $variables: new SceneVariableSet({ variables: [sectionVar1] }),
          }),
          new RowItem({
            title: 'Row 2',
            $variables: new SceneVariableSet({ variables: [sectionVar2] }),
          }),
        ],
      }),
    });
    activateFullSceneTree(dashboard);

    const result = collectDescendantVariables(dashboard);
    expect(result).toHaveLength(2);
    expect(result.map((v) => v.state.name)).toEqual(expect.arrayContaining(['custom0', 'custom1']));
  });
});
