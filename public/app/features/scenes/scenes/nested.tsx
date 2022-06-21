import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { VizPanel } from '../components/VizPanel';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';
import { SceneTimeRange } from '../querying/SceneTimeRange';

export function getNestedScene(): Scene {
  const scene = new Scene({
    title: 'Nested Scene demo',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          key: '3',
          pluginId: 'timeseries',
          title: 'Panel 3',
        }),
        getInnerScene('Inner scene'),
      ],
    }),
    $timeRange: new SceneTimeRange({
      timeRange: getDefaultTimeRange(),
    }),
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: 'gdev-testdata',
            type: 'testdata',
          },
          scenarioId: 'random_walk',
        },
      ],
    }),
  });

  return scene;
}

export function getInnerScene(title: string): Scene {
  const scene = new Scene({
    title: title,
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          key: '3',
          pluginId: 'timeseries',
          title: 'Data',
        }),
      ],
    }),
    $timeRange: new SceneTimeRange({
      timeRange: getDefaultTimeRange(),
    }),
    $data: new SceneQueryRunner({
      queries: [
        {
          refId: 'A',
          datasource: {
            uid: 'gdev-testdata',
            type: 'testdata',
          },
          scenarioId: 'random_walk',
        },
      ],
    }),
  });

  return scene;
}
