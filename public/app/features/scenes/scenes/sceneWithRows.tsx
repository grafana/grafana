import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getSceneWithRows(): Scene {
  const scene = new Scene({
    title: 'Scene with rows',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new NestedScene({
          title: 'Overview',
          canCollapse: true,
          layout: new SceneFlexLayout({
            direction: 'row',
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
            ],
          }),
        }),
        new NestedScene({
          title: 'More server details',
          canCollapse: true,
          layout: new SceneFlexLayout({
            direction: 'row',
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
            ],
          }),
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
