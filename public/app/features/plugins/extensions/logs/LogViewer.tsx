import { nanoid } from 'nanoid';
import { ReactElement, useMemo } from 'react';

import {
  EmbeddedScene,
  PanelBuilders,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneTimeRange,
  sceneUtils,
} from '@grafana/scenes';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { ExtensionsLogDataSource } from './dataSource';

const DATASOURCE_REF = {
  uid: nanoid(),
  type: 'grafana-extensions-log',
};

sceneUtils.registerRuntimeDataSource({
  dataSource: new ExtensionsLogDataSource(DATASOURCE_REF.type, DATASOURCE_REF.uid),
});

export default function PluginExtensionsLog(): ReactElement | null {
  const navModel = useSelector((state) => getNavModel(state.navIndex, 'extensions'));
  const scene = useLogPanelScene();

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <scene.Component model={scene} />
      </Page.Contents>
    </Page>
  );
}

function useLogPanelScene() {
  return useMemo(() => {
    const timeRange = new SceneTimeRange({
      from: 'now-6h',
      to: 'now',
    });

    const queryRunner = new SceneQueryRunner({
      datasource: DATASOURCE_REF,
      queries: [
        {
          refId: 'C',
          datasource: {
            uid: DATASOURCE_REF.uid,
          },
          expr: '<my prometheus query>',
        },
      ],
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
      controls: [],
    });
  }, []);
}
