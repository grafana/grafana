import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';

export function getRuleGroupEvaluationDurationScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: `grafanacloud_instance_rule_group_last_duration_seconds{rule_group="$rule_group"}`,
        range: true,
        legendFormat: '{{rule_group}}',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('How long it took to evaluate the rule group')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setUnit('s')
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setOverrides((b) =>
        b.matchFieldsByQuery('A').overrideColor({
          mode: 'fixed',
          fixedColor: 'blue',
        })
      )
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
