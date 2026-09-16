import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { changeVariableName } from './changeVariableName';

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

describe('changeVariableName', () => {
  it('renames the variable', () => {
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    buildScene(variableSet);

    changeVariableName({ source: existing, oldValue: 'existing', newValue: 'renamed' });

    expect(existing.state.name).toBe('renamed');
  });

  it('still renames a variable while a plan is being previewed', () => {
    // Editing variables during a preview is a documented capability of this feature, not
    // something to harden against — see planningPolicy.ts's comment on why rename-variable is
    // allowed (the assistant matches its own placeholders by a kind+query fingerprint, not
    // position, so a renamed placeholder still matches its own fingerprint at Build time).
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    const dashboard = buildScene(variableSet);
    dashboard.setState({
      planning: { planId: 'plan-1', planTitle: 'Plan', panelCount: 0, onBuild: () => {}, onDismiss: () => {} },
    });

    changeVariableName({ source: existing, oldValue: 'existing', newValue: 'renamed' });

    expect(existing.state.name).toBe('renamed');
  });

  it('leaves the variable type and query untouched by a rename, so a renamed placeholder still matches its fingerprint', () => {
    // The assistant identifies its own placeholder variables by a kind+query fingerprint, not by
    // name or position (see planningPolicy.ts). This test pins the property that makes that
    // matching safe across a rename: changeVariableName only ever touches `name`, never `type` or
    // `query`, so a renamed placeholder still fingerprints identically at Build time.
    const existing = new CustomVariable({ name: 'existing', query: 'a,b' });
    const variableSet = new SceneVariableSet({ variables: [existing] });
    buildScene(variableSet);

    changeVariableName({ source: existing, oldValue: 'existing', newValue: 'renamed' });

    expect(existing.state.type).toBe('custom');
    expect(existing.state.query).toBe('a,b');
  });
});
