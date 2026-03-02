import { render } from '@testing-library/react';

import { SceneGridLayout, SceneTimeRange, SceneVariableSet } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { DefaultGridLayoutManager } from '../../scene/layout-default/DefaultGridLayoutManager';
import { DashboardInteractions } from '../../utils/interactions';
import { activateFullSceneTree } from '../../utils/test-utils';

import { VariableAdd, VariableTypeSelection } from './VariableAddEditableElement';

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

function renderTestScene() {
  const dashboard = buildTestScene();
  const variableAdd = new VariableAdd({ dashboardRef: dashboard.getRef() });
  return render(<VariableTypeSelection variableAdd={variableAdd} />);
}

describe('VariableAddEditableElement', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calls DashboardInteractions.newVariableTypeSelected when a variable type is clicked', () => {
    const newVariableTypeSelectedSpy = jest.spyOn(DashboardInteractions, 'newVariableTypeSelected');

    const { getByRole } = renderTestScene();

    getByRole('button', { name: /query/i }).click();

    expect(newVariableTypeSelectedSpy).toHaveBeenCalledWith({ type: 'query' });
  });
});
