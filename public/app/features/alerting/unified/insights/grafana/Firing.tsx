import React from 'react';

import { ThresholdsMode } from '@grafana/data';
import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';

export function getFiringGrafanaAlertsScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: 'sum by (state) (grafanacloud_grafana_instance_alerting_rule_group_rules{state="active"})',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The number of currently firing alert rules')
      .setData(query)
      .setThresholds({
        mode: ThresholdsMode.Absolute,
        steps: [
          {
            color: 'red',
            value: 0,
          },
          {
            color: 'red',
            value: 80,
          },
        ],
      })
      .setNoValue('0')
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
