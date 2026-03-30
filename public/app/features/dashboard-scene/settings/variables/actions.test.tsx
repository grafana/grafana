import { sceneGraph, SceneGridLayout, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { openAddVariablePane } from './actions';

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

function buildTestScene() {
  const testScene = new DashboardScene({
    $variables: new SceneVariableSet({ variables: [] }),
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    isEditing: true,
    body: new DefaultGridLayoutManager({
      grid: new SceneGridLayout({
        children: [],
      }),
    }),
  });
  activateFullSceneTree(testScene);
  return testScene;
}

describe('variable actions', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('adds a default query variable, selects it, and tracks the query type', () => {
    const dashboard = buildTestScene();
    const newVariableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'newVariableTypeSelected');
    const variablesSet = sceneGraph.getVariables(dashboard) as SceneVariableSet;

    openAddVariablePane(dashboard);

    expect(variablesSet.state.variables).toHaveLength(1);
    expect(variablesSet.state.variables[0].state.name).toBe('query0');
    expect(variablesSet.state.variables[0].state.type).toBe('query');
    expect(dashboard.state.editPane.getSelection()).toBe(variablesSet.state.variables[0]);
    expect(newVariableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });
});
