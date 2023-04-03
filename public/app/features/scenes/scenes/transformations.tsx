import {
  SceneTimePicker,
  SceneFlexLayout,
  VizPanel,
  SceneDataTransformer,
  SceneTimeRange,
  SceneFlexItem,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getTransformationsDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Transformations demo',
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          body: new SceneFlexLayout({
            direction: 'column',
            children: [
              new SceneFlexItem({
                body: new SceneFlexLayout({
                  direction: 'row',
                  children: [
                    new SceneFlexItem({
                      body: new VizPanel({
                        pluginId: 'timeseries',
                        title: 'Source data (global query',
                      }),
                    }),
                    new SceneFlexItem({
                      body: new VizPanel({
                        pluginId: 'stat',
                        title: 'Transformed data',
                        $data: new SceneDataTransformer({
                          transformations: [
                            {
                              id: 'reduce',
                              options: {
                                reducers: ['last', 'mean'],
                              },
                            },
                          ],
                        }),
                      }),
                    }),
                  ],
                }),
              }),
              new SceneFlexItem({
                body: new VizPanel({
                  $data: new SceneDataTransformer({
                    $data: getQueryRunnerWithRandomWalkQuery(),
                    transformations: [
                      {
                        id: 'reduce',
                        options: {
                          reducers: ['mean'],
                        },
                      },
                    ],
                  }),

                  pluginId: 'stat',
                  title: 'Query with predefined transformations',
                }),
              }),
            ],
          }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });
}
