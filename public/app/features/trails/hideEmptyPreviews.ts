import { FieldType, LoadingState } from '@grafana/data';
import { SceneCSSGridItem, sceneGraph } from '@grafana/scenes';

import { MetricSelectScene } from './MetricSelectScene';

export function hideEmptyPreviews(metric: string) {
  return (gridItem: SceneCSSGridItem) => {
    const data = sceneGraph.getData(gridItem);
    if (!data) {
      return;
    }

    function subscribe() {
      data.subscribeToState((state) => {
        if (state.data?.state === LoadingState.Loading) {
          return;
        }
        const scene = sceneGraph.getAncestor(gridItem, MetricSelectScene);

        if (!state.data?.series.length) {
          scene.updateMetricPanel(metric, true, true);
          return;
        }

        for (const frame of state.data.series) {
          for (const field of frame.fields) {
            if (field.type !== FieldType.number) {
              continue;
            }

            const hasValue = field.values.find((v) => v != null);
            if (!hasValue) {
              scene.updateMetricPanel(metric, true, true);
              return;
            }

            const hasNonZeroValue = field.values.find((v) => v !== 0);
            if (!hasNonZeroValue) {
              scene.updateMetricPanel(metric, true, true);
              return;
            }
          }
        }
        scene.updateMetricPanel(metric, true);
      });
    }

    // Working around an issue in scenes lib where activationHandler is not called if the object is already active.
    if (data.isActive) {
      subscribe();
    } else {
      data.addActivationHandler(subscribe);
    }
  };
}
