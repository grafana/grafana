import { CustomVariable, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { RowItem } from '../../scene/layout-rows/RowItem';

import { shouldHideControlsMenuOption } from './VariableEditableElement';

describe('shouldHideControlsMenuOption', () => {
  it('returns false for dashboard-level variables', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });
    const variableSet = new SceneVariableSet({ variables: [variable] });

    new DashboardScene({
      $variables: variableSet,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: AutoGridLayoutManager.createEmpty(),
      isEditing: true,
    });

    expect(shouldHideControlsMenuOption(variable)).toBe(false);
  });

  it('returns true for section-level variables', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });
    const variableSet = new SceneVariableSet({ variables: [variable] });

    new RowItem({ $variables: variableSet });

    expect(shouldHideControlsMenuOption(variable)).toBe(true);
  });

  it('returns true when variable parent is not a SceneVariableSet', () => {
    const variable = new CustomVariable({ name: 'env', query: 'prod,dev', value: 'prod', text: 'prod' });

    expect(shouldHideControlsMenuOption(variable)).toBe(true);
  });
});
