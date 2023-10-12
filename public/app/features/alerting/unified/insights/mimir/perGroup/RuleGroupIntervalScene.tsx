import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { BigValueGraphMode, DataSourceRef } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';

export function getRuleGroupIntervalScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: 'interval',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription('The current and historical rule group evaluation interval')
      .setData(query)
      .setUnit('s')
      .setOption('graphMode', BigValueGraphMode.Area)
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
