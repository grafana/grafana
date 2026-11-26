import { VizPanel, sceneGraph, type SceneObject, SceneGridRow } from '@grafana/scenes';

import { getPickedPanelIds } from '../questions/questionSources';

import { getPanelIdForVizPanel } from './utils-panels';

/**
 * Will look for all panels in the entire scene starting from root
 * and find the next free panel id. IDs that questions still pick are not free, even once their panel is removed.
 */
export function getNextPanelId(scene: SceneObject): number {
  const root = scene.getRoot();
  let max = Math.max(0, ...getPickedPanelIds(root));

  sceneGraph
    .findAllObjects(
      root,
      (obj) => (obj instanceof VizPanel || obj instanceof SceneGridRow) && !obj.state.repeatSourceKey
    )
    .forEach((panel) => {
      const panelId = getPanelIdForVizPanel(panel);
      if (panelId > max) {
        max = panelId;
      }
    });

  return max + 1;
}
