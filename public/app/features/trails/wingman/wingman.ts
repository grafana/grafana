import { EmbeddedScene, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';

import { MetricScene } from '../MetricScene';
import { MetricSelectScene } from '../MetricSelect/MetricSelectScene';

import { WingmanScene } from './WingmanScene';

export function withWingman(topScene: MetricScene | MetricSelectScene) {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          width: '20%',
          height: '100%',
          body: new WingmanScene({}),
        }),
        topScene,
      ],
    }),
  });
}
