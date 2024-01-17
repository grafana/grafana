import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';

import { SelectMetricAction } from '../SelectMetricAction';
import { LOGS_METRIC } from '../shared';

export function buildLogsScene() {
  return new SceneFlexItem({
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: { uid: 'gdev-loki' },
          expr: '{${filters}} | logfmt',
        },
      ],
    }),
    body: PanelBuilders.logs()
      .setTitle('Logs')
      .setHeaderActions(new SelectMetricAction({ metric: LOGS_METRIC, title: 'Open' }))
      .build(),
  });
}
