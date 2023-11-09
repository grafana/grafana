import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, ThresholdsMode, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';

export function getRuleGroupEvaluationDurationIntervalRatioScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group"} / grafanacloud_instance_rule_group_interval_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: 'duration / interval',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The percentage of interval time spent evaluating')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setUnit('percentunit')
      .setThresholds({
        mode: ThresholdsMode.Percentage,
        steps: [
          {
            color: 'green',
            value: 0,
          },
          {
            color: 'red',
            value: 80,
          },
          {
            color: 'yellow',
            value: 60,
          },
        ],
      })
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
