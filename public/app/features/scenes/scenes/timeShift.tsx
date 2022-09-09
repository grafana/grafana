// import { getDefaultTimeRange } from '@grafana/data';

import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimeShiftNode } from '../components/SceneTimeShiftNode';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getScene(): Scene {
  const timeRangeNode1 = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const timeShiftNode = new SceneTimeShiftNode({
    inputParams: {
      range: timeRangeNode1,
    },
    timeShift: '-6h',
  });

  const timeShiftNode1 = new SceneTimeShiftNode({
    inputParams: {
      range: timeShiftNode,
    },
    timeShift: '-6h',
  });

  const queries = [
    {
      refId: 'A',
      datasource: {
        uid: 'gdev-testdata',
        type: 'testdata',
      },
      scenarioId: 'random_walk',
    },
  ];
  const dataNode1 = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode1,
    },
    queries,
  });

  const dataNode2 = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeShiftNode,
    },
    queries,
  });

  const dataNode3 = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeShiftNode1,
    },
    queries,
  });

  const scene = new Scene({
    $editor: new SceneEditManager({}),
    title: 'Time shift ranges',
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
                children: [timeRangeNode1, timeShiftNode, timeShiftNode1],
              }),
            ],
          }),

          new SceneFlexChild({
            children: [
              new SceneFlexLayout({
                children: [
                  new SceneFlexChild({
                    children: [
                      new VizPanel({
                        inputParams: {
                          data: dataNode1,
                        },
                        pluginId: 'timeseries',
                        title: 'Original',
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
                          data: dataNode2,
                        },
                        pluginId: 'timeseries',
                        title: 'Time range shifted',
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
                          data: dataNode3,
                        },
                        pluginId: 'timeseries',
                        title: 'Time range shifted',
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

export const timeShiftScene = {
  title: 'Scene with time shift ranges',
  getScene,
};
