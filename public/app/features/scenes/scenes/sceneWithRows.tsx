import {
  VizPanel,
  NestedScene,
  SceneTimePicker,
  SceneFlexLayout,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneFlexItem,
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
                body: new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
              }),

              new SceneFlexItem({
                body: new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
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
                body: new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
              }),
              new SceneFlexItem({
                body: new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
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
