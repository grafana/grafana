// import { getDefaultTimeRange } from '@grafana/data';

import { DataTransformerID, getDefaultTimeRange } from '@grafana/data';
import { NestedScene } from '../components/NestedScene';

import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneDataTransformationNode } from '../core/SceneTransformationNode';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getScene(): Scene {
  const timeRangeNode1 = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataNode = new SceneDataProviderNode({
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

  const transformationNode1 = new SceneDataTransformationNode({
    inputParams: {
      data: dataNode,
    },
    transformations: [
      {
        id: DataTransformerID.limit,
        options: {
          limitField: 100,
        },
      },
    ],
  });

  const transformationNode2 = new SceneDataTransformationNode({
    inputParams: {
      data: transformationNode1,
    },
    transformations: [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: ['min', 'max', 'mean'],
        },
      },
      {
        id: DataTransformerID.organize,
        options: {
          excludeByName: { Field: true },
        },
      },
    ],
  });

  const transformationNode3 = new SceneDataTransformationNode({
    inputParams: {
      data: transformationNode1,
    },
    transformations: [
      {
        id: DataTransformerID.reduce,
        options: {
          reducers: ['mean'],
        },
      },
    ],
  });

  const scene = new Scene({
    $editor: new SceneEditManager({}),
    title: 'Transformation node test',
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
                              data: dataNode,
                            },
                            pluginId: 'timeseries',
                            title: 'Raw data',
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
                              data: transformationNode3,
                            },
                            pluginId: 'stat',
                            title: 'Limit + reduce',
                          }),
                        ],
                      }),
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            inputParams: {
                              data: transformationNode2,
                            },
                            pluginId: 'table',
                            title: 'Reduce + organize',
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
              new NestedScene({
                title: 'Nested transformation',
                canCollapse: true,
                children: [
                  new SceneFlexLayout({
                    direction: 'row',
                    children: [
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            inputParams: {
                              data: transformationNode2,
                            },
                            pluginId: 'table',
                            title: 'Chained transformers: reduce + organize',
                            options: {},
                          }),
                        ],
                      }),
                      new SceneFlexChild({
                        children: [
                          new VizPanel({
                            inputParams: {
                              data: dataNode,
                            },
                            pluginId: 'table',
                            title: 'Raw data',
                            options: {},
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
  });

  return scene;
}

export const transformationsDemo = {
  title: 'Scene with transformations',
  getScene,
};
