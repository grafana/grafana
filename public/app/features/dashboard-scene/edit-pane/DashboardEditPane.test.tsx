import { DashboardScene, DashboardSceneState } from '../scene/DashboardScene';
import { DashboardEditActionEvent } from './shared';

describe('DashboardEditPane', () => {
  it('Handles edit action events that adds objects', () => {
    const scene = buildTestScene();
    const editPane = scene.state.editPane;

    scene.onCreateNewPanel();

    expect(editPane.state.undoStack).toHaveLength(1);
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

  return scene;
}
