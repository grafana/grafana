import { isEqual } from 'lodash';

import { type DataTransformerConfig } from '@grafana/data';
import { SceneDataTransformer, type SceneObject, VizPanel } from '@grafana/scenes';
import { sortedDeepCloneWithoutNulls } from 'app/core/utils/object';
import { TABLE_TRANSFORMATIONS_OWNER } from 'app/features/table/constants';

interface PanelAdHocTransformations {
  panel: VizPanel;
  pluginId: string;
  savedTransformations: unknown;
  transformations: readonly DataTransformerConfig[];
}

export type AdHocTransformationsByPanelKey = Map<string, PanelAdHocTransformations>;

export function collectAdHocTransformations(root: SceneObject, excluded?: VizPanel): AdHocTransformationsByPanelKey {
  const byPanelKey: AdHocTransformationsByPanelKey = new Map();
  for (const panel of findVizPanels(root)) {
    if (panel !== excluded && panel.state.key) {
      byPanelKey.set(panel.state.key, {
        panel,
        pluginId: panel.state.pluginId,
        savedTransformations: getSavedTransformations(panel),
        transformations: panel.getRuntimeTransformations().get(TABLE_TRANSFORMATIONS_OWNER),
      });
    }
  }
  return byPanelKey;
}

export function restoreAdHocTransformations(
  root: SceneObject,
  current: AdHocTransformationsByPanelKey,
  baseline?: AdHocTransformationsByPanelKey
) {
  for (const panel of findVizPanels(root)) {
    const key = panel.state.key;
    const live = key ? current.get(key) : undefined;
    if (!key || live?.panel === panel) {
      continue;
    }

    const savedTransformations = getSavedTransformations(panel);
    const source = [live, baseline?.get(key)].find(
      (candidate) =>
        candidate?.pluginId === panel.state.pluginId && isEqual(candidate.savedTransformations, savedTransformations)
    );
    if (source) {
      panel.getRuntimeTransformations().set(TABLE_TRANSFORMATIONS_OWNER, source.transformations);
    }
  }
}

function getSavedTransformations(panel: VizPanel): unknown {
  const data = panel.state.$data;
  return sortedDeepCloneWithoutNulls(data instanceof SceneDataTransformer ? data.state.transformations : []);
}

function findVizPanels(root: SceneObject, panels: VizPanel[] = []): VizPanel[] {
  root.forEachChild((child) => {
    if (child instanceof VizPanel) {
      panels.push(child);
    }
    findVizPanels(child, panels);
  });
  return panels;
}
