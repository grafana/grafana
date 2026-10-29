import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { addVariable } from './addVariable';

function buildScene(variableSet: SceneVariableSet) {
  const dashboard = new DashboardScene({
    $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
    $variables: variableSet,
    isEditing: true,
    body: AutoGridLayoutManager.createEmpty(),
  });

  activateFullSceneTree(dashboard);

  return dashboard;
}

describe('addVariable', () => {
  it('adds a variable to the set and supports undo/redo', () => {
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    const dashboard = buildScene(variableSet);

    const newVariable = new CustomVariable({ name: 'added', query: 'c,d' });
    addVariable({ source: variableSet, addedObject: newVariable });

    expect(variableSet.state.variables).toHaveLength(2);
    expect(variableSet.state.variables[0]).toBe(existing);
    expect(variableSet.state.variables[1]).toBe(newVariable);
    // Adding an element selects it so the user can edit it straight away
    expect(dashboard.state.sidebar.getSelectedObject()).toBe(newVariable);

    dashboard.state.sidebar.undoAction();

    expect(dashboard.state.sidebar.getSelectedObject()).toBe(undefined);

    expect(variableSet.state.variables).toHaveLength(1);
    expect(variableSet.state.variables[0]).toBe(existing);

    dashboard.state.sidebar.redoAction();

    expect(variableSet.state.variables).toHaveLength(2);
    expect(variableSet.state.variables[0]).toBe(existing);
    expect(variableSet.state.variables[1]).toBe(newVariable);
    expect(dashboard.state.sidebar.getSelectedObject()).toBe(newVariable);
  });

  it('when undone while the sidebar is docked, the dashboard is selected', () => {
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    const dashboard = buildScene(variableSet);
    dashboard.state.sidebar.setState({ isDocked: true });

    const newVariable = new CustomVariable({ name: 'added', query: 'c,d' });
    addVariable({ source: variableSet, addedObject: newVariable });

    dashboard.state.sidebar.undoAction();

    expect(dashboard.state.sidebar.getSelectedObject()).toBe(dashboard);
  });
});
