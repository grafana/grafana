import { config } from '@grafana/runtime';

import { DashboardScene } from '../scene/DashboardScene';
import { activateFullSceneTree } from '../utils/test-utils';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => {
    return {
      getInstanceSettings: (uid: string) => ({}),
    };
  },
}));

describe('DashboardEditPane', () => {
  it('Handles edit action events that adds objects', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    expect(editPane.state.undoStack).toHaveLength(1);

    // Should select object
    expect(editPane.getSelection()).toBeDefined();

    editPane.undoAction();

    expect(editPane.state.undoStack).toHaveLength(0);

    // should clear selection
    expect(editPane.getSelection()).toBeUndefined();
  });

  it('when new action comes in clears redo stack', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    editPane.undoAction();

    expect(editPane.state.redoStack).toHaveLength(1);

    scene.onCreateNewPanel();

    expect(editPane.state.redoStack).toHaveLength(0);
  });
});

function buildTestScene() {
  const scene = new DashboardScene({
    title: 'hello',
    uid: 'dash-1',
    description: 'hello description',
    tags: ['tag1', 'tag2'],
    editable: true,
  });

  config.featureToggles.dashboardNewLayouts = true;

  activateFullSceneTree(scene);

  return scene;
}
