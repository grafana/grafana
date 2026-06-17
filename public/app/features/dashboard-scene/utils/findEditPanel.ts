import { type SceneObject, VizPanel } from '@grafana/scenes';
import { findVizPanelByKey } from 'app/features/dashboard-scene/utils/findVizPanelByKey';

export function findEditPanel(scene: SceneObject, key: string | undefined): VizPanel | null {
  if (!key) {
    return null;
  }

  let panel: SceneObject | null = findVizPanelByKey(scene, key);
  if (!panel || !panel.state.key) {
    return null;
  }

  if (!(panel instanceof VizPanel)) {
    return null;
  }

  return panel;
}
