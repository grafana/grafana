import { EmbeddedScene, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';

import { MetricScene } from '../MetricScene';
import { MetricSelectScene } from '../MetricSelect/MetricSelectScene';

import { WingmanScene } from './WingmanScene';

export type AllowedWingmanOptions = 'opt_1' | 'opt_2' | 'opt_3';

export type WingmanOption = {
  label: string;
  description: string;
  enabled: boolean;
};

export type WingmanOptionCollection = Record<AllowedWingmanOptions, WingmanOption>;

export const getWingmanOptionCollection = (): WingmanOptionCollection => ({
  opt_1: { label: 'Option 1', description: 'Option 1', enabled: true },
  opt_2: { label: 'Option 2', description: 'Option 2', enabled: true },
  opt_3: { label: 'Option 3', description: 'Option 3', enabled: false },
});

export function withWingman(topScene: MetricScene | MetricSelectScene) {
  return new EmbeddedScene({
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          body: new WingmanScene({}),
        }),
        topScene,
      ],
    }),
  });
}
