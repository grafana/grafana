import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef } from '@grafana/schema';

import { overrideToFixedColor } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';
export function getInstanceStatByStatusScene(
  datasource: DataSourceRef,
  panelTitle: string,
  panelDescription: string,
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
  });

  return new SceneFlexItem({
    height: '100%',
    body: PanelBuilders.stat()
      .setTitle(panelTitle)
      .setDescription(panelDescription)
      .setData(query)
      .setOverrides((b) => b.matchFieldsWithName(status).overrideColor(overrideToFixedColor(status)))
      .setNoValue('0')
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
