import { SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../../scene/DashboardScene';
import { AutoGridLayoutManager } from '../../scene/layout-auto-grid/AutoGridLayoutManager';
import { activateFullSceneTree } from '../../utils/test-utils';

import { changeTitle } from './changeTitle';

describe('changeTitle', () => {
  it('changes the dashboard title and supports undo/redo', () => {
    const dashboard = new DashboardScene({
      title: 'Old title',
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      isEditing: true,
      body: AutoGridLayoutManager.createEmpty(),
    });

    activateFullSceneTree(dashboard);

    changeTitle({ source: dashboard, oldValue: 'Old title', newValue: 'New title' });

    expect(dashboard.state.title).toBe('New title');

    dashboard.state.sidebar.undoAction();

    expect(dashboard.state.title).toBe('Old title');

    dashboard.state.sidebar.redoAction();

    expect(dashboard.state.title).toBe('New title');
  });
});
