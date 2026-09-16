import { type DropResult } from '@hello-pangea/dnd';

import { VariableHide } from '@grafana/data';
import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { createDragEndHandler, type ListIds } from './variableListActions';

const listIds: ListIds = { visible: 'visible', controlsMenu: 'controls-menu', hidden: 'hidden' };
const droppableToHide: Record<string, VariableHide> = {
  [listIds.visible]: VariableHide.dontHide,
  [listIds.controlsMenu]: VariableHide.inControlsMenu,
  [listIds.hidden]: VariableHide.hideVariable,
};

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

function dropResult(source: number, destination: number): DropResult {
  return {
    source: { droppableId: listIds.visible, index: source },
    destination: { droppableId: listIds.visible, index: destination },
    reason: 'DROP',
    mode: 'FLUID',
    draggableId: 'x',
    combine: null,
  } as DropResult;
}

describe('createDragEndHandler', () => {
  it('reorders the variable set', () => {
    const a = new CustomVariable({ name: 'a', query: 'a' });
    const b = new CustomVariable({ name: 'b', query: 'b' });
    const variableSet = new SceneVariableSet({ variables: [a, b] });
    buildScene(variableSet);

    const onDragEnd = createDragEndHandler(variableSet, listIds, [a, b], [], [], 'Reorder', droppableToHide);
    onDragEnd(dropResult(0, 1));

    // Compares names rather than toEqual/toBe on the live SceneVariable array: a failure there
    // would crash Jest's worker trying to relay the circular scene object over IPC (see T9) --
    // confirmed empirically while writing this test, not just theoretically.
    expect(variableSet.state.variables.map((v) => v.state.name)).toEqual(['b', 'a']);
  });

  it('refuses to reorder while a plan is being previewed', () => {
    const a = new CustomVariable({ name: 'a', query: 'a' });
    const b = new CustomVariable({ name: 'b', query: 'b' });
    const variableSet = new SceneVariableSet({ variables: [a, b] });
    const dashboard = buildScene(variableSet);
    dashboard.setState({
      planning: { planId: 'plan-1', planTitle: 'Plan', panelCount: 0, onBuild: () => {}, onDismiss: () => {} },
    });

    const onDragEnd = createDragEndHandler(variableSet, listIds, [a, b], [], [], 'Reorder', droppableToHide);
    onDragEnd(dropResult(0, 1));

    expect(variableSet.state.variables.map((v) => v.state.name)).toEqual(['a', 'b']);
  });
});
