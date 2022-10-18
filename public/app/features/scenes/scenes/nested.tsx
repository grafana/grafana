import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getNestedScene(): Scene {
  const scene = new Scene({
    title: 'Nested Scene demo',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        getInnerScene('Inner scene'),
        new VizPanel({
          key: '3',
          pluginId: 'timeseries',
          title: 'Panel 3',
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
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
    actions: [new SceneTimePicker({})],
  });

  return scene;
}

export function getInnerScene(title: string) {
  const scene = new NestedScene({
    title: title,
    canRemove: true,
    canCollapse: true,
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
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
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
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
