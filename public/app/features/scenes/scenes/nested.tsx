import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../models/Scene';
import { SceneFlexLayout } from '../models/SceneFlexLayout';
import { SceneQueryRunner } from '../models/SceneQueryRunner';
import { SceneTimeRange } from '../models/SceneTimeRange';
import { VizPanel } from '../models/VizPanel';

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
