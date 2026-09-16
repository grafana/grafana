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

  it('still reorders while a plan is being previewed', () => {
    // Editing variables during a preview is a documented capability of this feature, not
    // something to harden against — see planningPolicy.ts's comment on why move-variable is
    // allowed (the assistant matches its own placeholders by a kind+query fingerprint, not
    // position, so this cannot cause a placeholder mismatch at Build time).
    const a = new CustomVariable({ name: 'a', query: 'a' });
    const b = new CustomVariable({ name: 'b', query: 'b' });
    const variableSet = new SceneVariableSet({ variables: [a, b] });
    const dashboard = buildScene(variableSet);
    dashboard.setState({
      planning: { planId: 'plan-1', planTitle: 'Plan', panelCount: 0, onBuild: () => {}, onDismiss: () => {} },
    });

    const onDragEnd = createDragEndHandler(variableSet, listIds, [a, b], [], [], 'Reorder', droppableToHide);
    onDragEnd(dropResult(0, 1));

    expect(variableSet.state.variables.map((v) => v.state.name)).toEqual(['b', 'a']);
  });

  it('leaves each variable type and query untouched by a reorder, so a reordered placeholder still matches its fingerprint', () => {
    // Pins the property that makes move-variable safe to permit during planning: reordering only
    // ever changes array order (and, when crossing lists, `hide`), never `type` or `query`, so a
    // reordered placeholder still fingerprints identically at Build time.
    const a = new CustomVariable({ name: 'a', query: 'a' });
    const b = new CustomVariable({ name: 'b', query: 'b' });
    const variableSet = new SceneVariableSet({ variables: [a, b] });
    buildScene(variableSet);

    const onDragEnd = createDragEndHandler(variableSet, listIds, [a, b], [], [], 'Reorder', droppableToHide);
    onDragEnd(dropResult(0, 1));

    expect(a.state.type).toBe('custom');
    expect(a.state.query).toBe('a');
    expect(b.state.type).toBe('custom');
    expect(b.state.query).toBe('b');
  });
});
