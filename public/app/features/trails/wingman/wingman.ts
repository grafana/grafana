import { EmbeddedScene, SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';

import { MetricScene } from '../MetricScene';
import { MetricSelectScene } from '../MetricSelect/MetricSelectScene';

import { WingmanScene } from './WingmanScene';

export type WingmanOption = {
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
};

export type WingmanOptionCollection = Record<string, WingmanOption>;

export type WingmanOptionGroup = {
  title: string;
  options: WingmanOptionCollection;
};

// TODO ideally all keys should be unique. So opt_1, opt_2 should be replaced with actual keys.
export const getWingmanOptionGroup = (): WingmanOptionGroup[] => [
  {
    title: 'Display view',
    options: {
      opt_1: { label: 'Default', description: 'Option 1', enabled: true, available: true },
      opt_2: { label: 'RED Metrics', description: 'Option 2', enabled: true, available: true },
      opt_3: { label: 'Anomalies', description: 'Option 3', enabled: false, available: true },
    },
  },
  {
    title: 'Group by',
    options: {
      opt_1: { label: 'None', description: 'Option 1', enabled: true, available: true },
      opt_2: { label: 'Alerts', description: 'Option 2', enabled: true, available: true },
      opt_3: { label: 'Dashboards', description: 'Option 3', enabled: false, available: true },
      opt_4: { label: 'Metric name', description: 'Option 3', enabled: false, available: true },
      opt_5: { label: 'Services', description: 'Option 3', enabled: false, available: true },
    },
  },
  {
    title: 'Sort by',
    options: {
      opt_1: { label: 'Alphabetical (A-Z)', description: 'Option 1', enabled: true, available: true },
      opt_2: { label: 'Alphabetical (Z-A)', description: 'Option 2', enabled: true, available: true },
      opt_3: { label: 'Org - most queried', description: 'Option 3', enabled: false, available: true },
      opt_4: { label: 'Org - most recent', description: 'Option 3', enabled: false, available: true },
      opt_5: { label: 'Team - most queried', description: 'Option 3', enabled: false, available: true },
      opt_6: { label: 'Team - most recent', description: 'Option 3', enabled: false, available: true },
    },
  },
];

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
