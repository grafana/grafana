import { SceneFlexItem } from '@grafana/scenes';

import { MetrricSelectScene } from '../MetricSelectScene';

export function buildRelatedMetricsScene() {
  return new SceneFlexItem({
    body: new MetrricSelectScene({}),
  });
}
