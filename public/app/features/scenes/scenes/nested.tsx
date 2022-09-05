import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getNestedScene(): Scene {
  const timeRangeNode = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataProviderNode = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode,
    },
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
  });

  const scene = new Scene({
    title: 'Nested Scene demo',
    $editor: new SceneEditManager({}),
    children: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexChild({
            size: { ySizing: 'content' },
            children: [timeRangeNode],
          }),
          new SceneFlexChild({
            children: [
              new SceneFlexLayout({
                direction: 'column',
                children: [
                  new SceneFlexChild({
                    children: [
                      new VizPanel({
                        inputParams: {
                          data: dataProviderNode,
                        },
                        key: '3',
                        pluginId: 'timeseries',
                        title: 'Panel 3',
                      }),
                    ],
                  }),

                  getInnerScene('Inner scene'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return scene;
}

export function getInnerScene(title: string) {
  const timeRangeNode = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataProviderNode = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode,
    },
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
  });

  const scene = new NestedScene({
    title: title,
    canCollapse: true,
    canRemove: true,
    isCollapsed: false,
    actions: [timeRangeNode],
    children: [
      new SceneFlexLayout({
        direction: 'row',
        children: [
          new SceneFlexChild({
            children: [
              new VizPanel({
                inputParams: {
                  data: dataProviderNode,
                },
                key: '3',
                pluginId: 'timeseries',
                title: 'Data',
              }),
            ],
          }),
          new SceneFlexChild({
            children: [
              new VizPanel({
                inputParams: {
                  data: dataProviderNode,
                },
                key: '3',
                pluginId: 'timeseries',
                title: 'Data',
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return scene;
}
