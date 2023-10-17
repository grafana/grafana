import { PanelBuilders, SceneFlexItem, SceneQueryRunner } from '@grafana/scenes';

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
    body: PanelBuilders.logs().setTitle('Logs').build(),
  });
}
