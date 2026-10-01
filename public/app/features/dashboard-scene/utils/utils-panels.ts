import { type SceneObject } from '@grafana/scenes';

export function getVizPanelKeyForPanelId(panelId: number) {
  return `panel-${panelId}`;
}

export function getGridItemKeyForPanelId(panelId: number): string {
  return `grid-item-${panelId}`;
}

export function getPanelIdForVizPanel(panel: SceneObject): number {
  return parseInt(panel.state.key!.replace('panel-', ''), 10);
}
