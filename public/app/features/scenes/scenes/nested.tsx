import { VizPanel } from '../components';
import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

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
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
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
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
