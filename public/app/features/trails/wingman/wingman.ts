import { SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';

import { MetricSelectSceneForWingman } from './MetricSelectSceneForWingman';
import { WingmanScene } from './WingmanScene';

export type WingmanOption = {
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
};

export type WingmanOptionCollection = Record<string, WingmanOption>;

export type WingmanOptionGroup = {
  id: string;
  title: string;
  options: WingmanOptionCollection;
};

type ExtractOptionKeys<T extends WingmanOptionGroup[]> =
  T[number]['options'] extends Record<infer K, WingmanOption> ? K : never;

// returns all group option keys as union type
export type AllOptionKeys = ExtractOptionKeys<ReturnType<typeof getWingmanOptionGroup>>;

export const getAllOptionKeys = (): string[] => {
  return getWingmanOptionGroup().flatMap((group) => Object.keys(group.options));
};

export const getWingmanOptionGroup = (): WingmanOptionGroup[] => [
  {
    id: 'wm_display_view',
    title: 'Display view',
    options: {
      default: { label: 'Default', description: 'Option 1', enabled: true, available: true },
      red_metrics: { label: 'RED Metrics', description: 'Option 2', enabled: true, available: true },
      anomalies: { label: 'Anomalies', description: 'Option 3', enabled: false, available: true },
    },
  },
  {
    id: 'wm_group_by',
    title: 'Group by',
    options: {
      none: { label: 'None', description: 'Option 1', enabled: true, available: true },
      alerts: { label: 'Alerts', description: 'Option 2', enabled: true, available: true },
      dashboards: { label: 'Dashboards', description: 'Option 3', enabled: false, available: true },
      metric_name: { label: 'Metric name', description: 'Option 3', enabled: false, available: true },
      services: { label: 'Services', description: 'Option 3', enabled: false, available: true },
    },
  },
  {
    id: 'wm_sort_by',
    title: 'Sort by',
    options: {
      alphabetical_az: { label: 'Alphabetical (A-Z)', description: 'Option 1', enabled: true, available: true },
      alphabetical_za: { label: 'Alphabetical (Z-A)', description: 'Option 2', enabled: true, available: true },
      org_most_queried: { label: 'Org - most queried', description: 'Option 3', enabled: false, available: true },
      org_most_recent: { label: 'Org - most recent', description: 'Option 3', enabled: false, available: true },
      team_most_queried: { label: 'Team - most queried', description: 'Option 3', enabled: false, available: true },
      team_most_recent: { label: 'Team - most recent', description: 'Option 3', enabled: false, available: true },
    },
  },
];

export function withWingman(topScene: MetricSelectSceneForWingman) {
  return new EmbeddedSceneWithContext({
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
