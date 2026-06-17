import type { SceneObject } from '@grafana/scenes';

export function getPanelIdForVizPanel(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}
