import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { overrideToFixedColor, PANEL_STYLES } from '../../../home/Insights';
import { InsightsRatingModal } from '../../RatingModal';

export function getMissedIterationsScene(datasource: DataSourceRef, panelTitle: string) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        expr: 'sum(grafanacloud_instance_rule_group_iterations_missed_total:rate5m)',
        range: true,
        legendFormat: 'missed',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of evaluations missed')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOption('legend', { showLegend: false })
      .setOverrides((b) => b.matchFieldsWithName('missed').overrideColor(overrideToFixedColor('missed')))
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
