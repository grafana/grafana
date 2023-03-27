import { SceneTimePicker, SceneFlexLayout, VizPanel, SceneDataTransformer, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getTransformationsDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Transformations demo',
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexLayout({
              direction: 'row',
              children: [
                new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Source data (global query',
                }),
                new VizPanel({
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
              ],
            }),

            new VizPanel({
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
          ],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });
}
