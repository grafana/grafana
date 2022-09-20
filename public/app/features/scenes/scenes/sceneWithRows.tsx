import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getScene(): Scene {
  const timeRange = new SceneTimeRange({ range: getDefaultTimeRange() });

  const dataNode = new SceneDataProviderNode({
    queries: getQueryRunnerWithRandomWalkQuery(),
    inputParams: { timeRange },
  });

  const dataNode1 = new SceneDataProviderNode({
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        scenarioId: 'random_walk_table',
      },
    ],
    inputParams: { timeRange },
  });

  const scene = new Scene({
    title: 'Scene with rows',
    children: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneToolbar({
            orientation: 'horizontal',
            children: [new SceneTimePicker({ inputParams: { timeRange } })],
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
                        inputParams: {
                          data: dataNode,
                        },
                        pluginId: 'timeseries',
                        title: 'Fill height',
                      }),
                    ],
                  }),
                  new SceneFlexChild({
                    children: [
                      new VizPanel({
                        inputParams: {
                          data: dataNode,
                        },
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
                        inputParams: {
                          data: dataNode,
                        },
                        pluginId: 'timeseries',
                        title: 'Fill height',
                      }),
                    ],
                  }),
                  new SceneFlexChild({
                    children: [
                      new VizPanel({
                        inputParams: {
                          data: dataNode1,
                        },
                        pluginId: 'table',
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
    $editor: new SceneEditManager({}),
  });

  return scene;
}

export const sceneWithRows = {
  title: 'Scene with rows',
  getScene,
};
