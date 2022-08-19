import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getSceneWithRows(): Scene {
  const timeRange = new SceneTimeRange({ range: getDefaultTimeRange() });

  const scene = new Scene({
    title: 'Scene with rows',
    children: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneDataProviderNode({
            queries: getQueryRunnerWithRandomWalkQuery(),
            inputParams: { timeRange },
            children: [
              new SceneToolbar({
                orientation: 'horizontal',
                children: [timeRange],
              }),
              new NestedScene({
                title: 'Overview',
                canCollapse: true,
                children: [
                  new SceneFlexLayout({
                    direction: 'row',
                    children: [
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            pluginId: 'timeseries',
                            title: 'Fill height',
                          }),
                        ],
                      }),
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            pluginId: 'timeseries',
                            title: 'Fill height',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),

              new NestedScene({
                title: 'More server details',
                canCollapse: true,
                children: [
                  new SceneFlexLayout({
                    direction: 'row',
                    children: [
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            pluginId: 'timeseries',
                            title: 'Fill height',
                          }),
                        ],
                      }),
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            pluginId: 'timeseries',
                            title: 'Fill height',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    $editor: new SceneEditManager({}),
  });

  return scene;
}
