import { FieldType, LoadingState } from '@grafana/data';
import { SceneCSSGridItem, sceneGraph, SceneQueryRunner, VizPanel } from '@grafana/scenes';

import { AnomaliesScene } from './AnomaliesScene';

export function hideEmptyPanels(metric: string) {
  // eslint-disable-next-line no-console
  console.debug('hideEmptyPanels');
  return (gridItem: SceneCSSGridItem) => {
    const scene = sceneGraph.getAncestor(gridItem, AnomaliesScene);
    const vizPanel = sceneGraph.findDescendents(gridItem, VizPanel).at(0) as VizPanel;

    if (!vizPanel) {
      // eslint-disable-next-line no-console
      console.debug('vizPanel not found');
      return;
    }

    const queryRunner = sceneGraph.getData(vizPanel) as SceneQueryRunner;

    queryRunner.subscribeToState((state) => {
      if (state.data?.state === LoadingState.Loading || state.data?.state === LoadingState.Error) {
        return;
      }

      const datasourceUid = queryRunner.state.datasource?.uid;

      if (!datasourceUid) {
        // eslint-disable-next-line no-console
        console.debug('Datasource UID not found');
        return;
      }

      if (!state.data?.series.length) {
        scene.ignorePanel(metric, datasourceUid);
        return;
      }

      let hasValue = false;
      for (const frame of state.data.series) {
        for (const field of frame.fields) {
          if (field.type !== FieldType.number) {
            continue;
          }

          hasValue = field.values.some((v) => v != null && !isNaN(v) && v !== 0);
          if (hasValue) {
            break;
          }
        }
        if (hasValue) {
          break;
        }
      }

      if (!hasValue) {
        scene.ignorePanel(metric, datasourceUid);
      }
    });
  };
}
