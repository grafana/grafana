import { SceneObject } from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { SceneEditManager } from './SceneEditManager';

export function getEditor(model: SceneObject): SceneEditManager {
  if (model instanceof DashboardScene && model.state.editor) {
    return model.state.editor;
  }

  if (!model.parent) {
    throw new Error('Could not find editor');
  }

  return getEditor(model.parent);
}
