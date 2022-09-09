// import { getDefaultTimeRange } from '@grafana/data';

import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getScene(): Scene {
  const timeRangeNode1 = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataNode1 = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode1,
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

  const timeRangeNode2 = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataNode2 = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode2,
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
    $editor: new SceneEditManager({}),
    title: 'Flex layout test',
    children: [
      new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexLayout({
            direction: 'column',
            children: [
              new SceneFlexChild({
                size: {
                  ySizing: 'content',
                },
                children: [
                  new SceneToolbar({
                    orientation: 'horizontal',
                    children: [timeRangeNode1],
                  }),
                ],
              }),
              new SceneFlexChild({
                children: [
                  new SceneFlexLayout({
                    direction: 'row',
                    children: [
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            inputParams: {
                              data: dataNode1,
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: { displayMode: 'hidden' },
                            },
                          }),
                        ],
                      }),

                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            inputParams: {
                              data: dataNode1,
                            },
                            pluginId: 'timeseries',
                            title: 'Title',
                            options: {
                              legend: { displayMode: 'hidden' },
                            },
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new SceneFlexChild({
            children: [
              new SceneFlexLayout({
                direction: 'column',
                children: [
                  new SceneFlexChild({
                    size: { ySizing: 'content' },
                    children: [
                      new SceneToolbar({
                        orientation: 'horizontal',
                        children: [timeRangeNode2],
                      }),
                    ],
                  }),
                  new SceneFlexChild({
                    children: [
                      new VizPanel({
                        inputParams: {
                          data: dataNode2,
                        },
                        pluginId: 'timeseries',
                        title: 'Title',
                        options: {
                          legend: { displayMode: 'hidden' },
                        },
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
  });

  return scene;
}

export const flexLayout = {
  title: 'Flex layout test',
  getScene,
};
