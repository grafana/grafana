import React from 'react';

import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';
import { DataSourceRef, GraphDrawStyle, TooltipDisplayMode } from '@grafana/schema';

import { INSTANCE_ID, overrideToFixedColor, PANEL_STYLES } from '../../home/Insights';
import { InsightsRatingModal } from '../RatingModal';

export function getNotificationsScene(datasource: DataSourceRef, panelTitle: string) {
  const exprA = INSTANCE_ID
    ? `sum by(cluster)(grafanacloud_instance_alertmanager_notifications_per_second{id="${INSTANCE_ID}"}) - sum by (cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second{id="${INSTANCE_ID}"})`
    : `sum by(cluster)(grafanacloud_instance_alertmanager_notifications_per_second) - sum by (cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)`;

  const exprB = INSTANCE_ID
    ? `sum by(cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second{id="${INSTANCE_ID}"})`
    : `sum by(cluster)(grafanacloud_instance_alertmanager_notifications_failed_per_second)`;

  const query = new SceneQueryRunner({
    datasource,
    queries: [
      {
        refId: 'A',
        exprA,
        range: true,
        legendFormat: 'success',
      },
      {
        refId: 'B',
        exprB,
        range: true,
        legendFormat: 'failed',
      },
    ],
  });

  return new SceneFlexItem({
    ...PANEL_STYLES,
    body: PanelBuilders.timeseries()
      .setTitle(panelTitle)
      .setDescription('The number of successful and failed notifications')
      .setData(query)
      .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
      .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
      .setOverrides((b) =>
        b
          .matchFieldsWithName('success')
          .overrideColor(overrideToFixedColor('success'))
          .matchFieldsWithName('failed')
          .overrideColor(overrideToFixedColor('failed'))
      )
      .setHeaderActions(<InsightsRatingModal panel={panelTitle} />)
      .build(),
  });
}
