import { FieldType, LoadingState } from '@grafana/data';
import { SceneCSSGridItem, sceneGraph } from '@grafana/scenes';

import { MetricSelectScene } from './MetricSelectScene';

export function hideEmptyPreviews(metric: string) {
  return (gridItem: SceneCSSGridItem) => {
    const data = sceneGraph.getData(gridItem);
    if (!data) {
      return;
    }

    data.subscribeToState((state) => {
      if (state.data?.state === LoadingState.Loading || state.data?.state === LoadingState.Error) {
        return;
      }
      const scene = sceneGraph.getAncestor(gridItem, MetricSelectScene);

      if (!state.data?.series.length) {
        scene.updateMetricPanel(metric, true, true);
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
      scene.updateMetricPanel(metric, true, !hasValue);
    });
  };
}
