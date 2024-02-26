import { SceneFlexItem } from '@grafana/scenes';

import { MetricSelectScene } from '../MetricSelectScene';

export function buildRelatedMetricsScene() {
  return new SceneFlexItem({
    body: new MetricSelectScene({}),
  });
}
