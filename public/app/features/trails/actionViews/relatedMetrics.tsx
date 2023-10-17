import { SceneFlexItem } from '@grafana/scenes';

import { MetricSelectLayout } from '../MetricSelectLayout';

export function buildRelatedMetricsScene() {
  return new SceneFlexItem({
    body: new MetricSelectLayout({}),
  });
}
