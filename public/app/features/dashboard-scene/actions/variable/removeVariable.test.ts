import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { removeVariable } from './removeVariable';

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

describe('removeVariable', () => {
  it('removes a variable from the set', () => {
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    buildScene(variableSet);

    removeVariable({ source: variableSet, removedObject: existing });

    expect(variableSet.state.variables).toHaveLength(0);
  });

  it('still removes a variable while a plan is being previewed', () => {
    // Editing variables during a preview is a documented capability of this feature, not
    // something to harden against — see planningPolicy.ts's comment on why remove-variable is
    // allowed (the assistant matches its own placeholders by a kind+query fingerprint, not
    // position, so this cannot cause a placeholder mismatch at Build time).
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    const dashboard = buildScene(variableSet);
    dashboard.setState({
      planning: { planId: 'plan-1', planTitle: 'Plan', panelCount: 0, onBuild: () => {}, onDismiss: () => {} },
    });

    removeVariable({ source: variableSet, removedObject: existing });

    // Compares names rather than toEqual/toBe on the live SceneVariable array: a failure there
    // would crash Jest's worker trying to relay the circular scene object over IPC (see T9).
    expect(variableSet.state.variables.map((v) => v.state.name)).toEqual([]);
  });
});
