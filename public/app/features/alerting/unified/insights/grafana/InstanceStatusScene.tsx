import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner, SceneTimeRange } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { overrideToFixedColor } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getInstanceStatByStatusScene(
  timeRange: SceneTimeRange,
  datasource: DataSourceRef,
  panelTitle: string,
  status: 'alerting' | 'pending' | 'nodata' | 'normal' | 'error'
) {
  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        instant: true,
        expr: `sum by (state) (grafanacloud_grafana_instance_alerting_alerts{state="${status}"})`,
        legendFormat: '{{state}}',
      },
    ],
    $timeRange: timeRange,
  });

  return new SceneFlexItem({
    height: '100%',
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelTitle)
      .setData(query)
      .setOverrides((b) => b.matchFieldsWithName(status).overrideColor(overrideToFixedColor(status)))
      .setNoValue('0')
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
