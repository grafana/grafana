import { MetricSelectScene } from '../MetricSelect/MetricSelectScene';
import { MetricScene } from '../MetricScene';
import { getSearchQuery } from '../utils';

export function buildRelatedMetricsScene(scene: MetricScene) {
  return new MetricSelectScene({ searchQuery: getSearchQuery(scene) });
}
