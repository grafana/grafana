import {
  NestedScene,
  SceneTimePicker,
  SceneFlexLayout,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneFlexItem,
  PanelBuilders,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getSceneWithRows(): DashboardScene {
  return new DashboardScene({
    title: 'Scene with rows',
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new NestedScene({
          title: 'Overview',
          canCollapse: true,
          body: new SceneFlexLayout({
            direction: 'row',
            children: [
              new SceneFlexItem({
                body: PanelBuilders.timeseries().setTitle('Fill height').build(),
              }),

              new SceneFlexItem({
                body: PanelBuilders.timeseries().setTitle('Fill height').build(),
              }),
            ],
          }),
        }),
        new NestedScene({
          title: 'More server details',
          canCollapse: true,
          body: new SceneFlexLayout({
            direction: 'row',
            children: [
              new SceneFlexItem({
                body: PanelBuilders.timeseries().setTitle('Fill height').build(),
              }),
              new SceneFlexItem({
                body: PanelBuilders.timeseries().setTitle('Fill height').build(),
              }),
            ],
          }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({}), new SceneRefreshPicker({})],
  });
}
