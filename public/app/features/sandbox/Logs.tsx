import { useMemo } from 'react';

import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  SceneTimeRange,
  sceneUtils,
} from '@grafana/scenes';

import { MyCustomDS } from './CustomDataSource';

const getScene = () => {
  const timeRange = new SceneTimeRange({
    from: 'now-6h',
    to: 'now',
  });

  const DATASOURCE_REF = {
    uid: 'my-custom-ds-uid',
    type: 'my-custom-ds',
  };

  const queryRunner = new SceneQueryRunner({
    datasource: DATASOURCE_REF,
    queries: [{ refId: 'C', datasource: { uid: 'my-custom-ds-uid' }, expr: '<my prometheus query>' }],
    maxDataPoints: 1000,
  });

  return new EmbeddedScene({
    $timeRange: timeRange,
    $data: queryRunner,
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          minHeight: 300,
          body: PanelBuilders.logs().setTitle('Logs').build(),
        }),
      ],
    }),
    controls: [
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({
        intervals: ['5s', '1m', '1h'],
        isOnCanvas: true,
        refresh: 'auto',
      }),
    ],
  });
};

// Important to specify a unique pluginId and uid for your data source that is unlikely to confict with any other scene app plugin.
sceneUtils.registerRuntimeDataSource({
  dataSource: new MyCustomDS('my-custom-ds-uid', 'my-custom-ds'),
});

export function Logs() {
  const scene = useMemo(() => getScene(), []);

  return <scene.Component model={scene} />;
}
