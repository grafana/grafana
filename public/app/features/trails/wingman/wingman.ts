import { useMemo } from 'react';

import { SceneFlexItem, SceneFlexLayout } from '@grafana/scenes';
import { EmbeddedSceneWithContext } from '@grafana/scenes-react';

import { MetricSelectSceneForWingman } from './MetricSelectSceneForWingman';
import { WingmanScene } from './WingmanScene';

export type WingmanOption = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  available: boolean;
  isDefault?: boolean;
};

const WingmanGroupKeys = ['wm_display_view', 'wm_group_by', 'wm_sort_by'] as const;
export type WingmanGroupKeyType = (typeof WingmanGroupKeys)[number];

export function isWingmanGroupKey(key: string | null | undefined): key is WingmanGroupKeyType {
  return WingmanGroupKeys.includes(key as WingmanGroupKeyType);
}

export type WingmanOptionGroup = {
  id: WingmanGroupKeyType;
  title: string;
  options: WingmanOption[];
};

// Only one option in each group can be enabled
// Non-available options should be shown grayed out
export const useWingmanOptionGroup = (): WingmanOptionGroup[] => {
  return useMemo(
      () => [
        {
          id: 'wm_display_view',
          title: 'Display view',
          options: [
            {
              id: 'default',
              label: 'Default',
              description: 'Option 1',
              enabled: true,
              available: true,
              isDefault: true,
            },
            {id: 'red_metrics', label: 'RED Metrics', description: 'Option 2', enabled: false, available: true},
            {id: 'anomalies', label: 'Anomalies', description: 'Option 3', enabled: false, available: true},
          ],
        },
        {
          id: 'wm_group_by',
          title: 'Group by',
          options: [
            {
              id: 'none',
              label: 'None',
              description: 'Option 1',
              enabled: true,
              available: true,
              isDefault: true,
            },
            {id: 'alerts', label: 'Alerts', description: 'Option 2', enabled: false, available: false},
            {id: 'dashboards', label: 'Dashboards', description: 'Option 3', enabled: false, available: false},
            {
              id: 'metric_name',
              label: 'Metric name',
              description: 'Option 3',
              enabled: false,
              available: false,
            },
            {id: 'services', label: 'Services', description: 'Option 3', enabled: false, available: false},
          ],
        },
        {
          id: 'wm_sort_by',
          title: 'Sort by',
          options: [
            {
              id: 'alphabetical_az',
              label: 'Alphabetical (A-Z)',
              description: 'Option 1',
              enabled: true,
              available: true,
              isDefault: true,
            },
            {
              id: 'alphabetical_za',
              label: 'Alphabetical (Z-A)',
              description: 'Option 2',
              enabled: false,
              available: false,
            },
            {
              id: 'org_most_queried',
              label: 'Org - most queried',
              description: 'Option 3',
              enabled: false,
              available: false,
            },
            {
              id: 'org_most_recent',
              label: 'Org - most recent',
              description: 'Option 3',
              enabled: false,
              available: false,
            },
            {
              id: 'team_most_queried',
              label: 'Team - most queried',
              description: 'Option 3',
              enabled: false,
              available: false,
            },
            {
              id: 'team_most_recent',
              label: 'Team - most recent',
              description: 'Option 3',
              enabled: false,
              available: false,
            },
          ],
        },
      ],
      []
  );
};

export function withWingman(topScene: MetricSelectSceneForWingman) {
  return new EmbeddedSceneWithContext({
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          width: '20%',
          body: new WingmanScene({}),
        }),
        topScene,
      ],
    }),
  });
}
