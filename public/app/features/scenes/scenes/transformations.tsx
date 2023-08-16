import {
  SceneTimePicker,
  SceneFlexLayout,
  SceneDataTransformer,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneFlexItem,
  PanelBuilders,
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
                      body: PanelBuilders.timeseries().setTitle('Source data (global query)').build(),
                    }),
                    new SceneFlexItem({
                      body: PanelBuilders.stat()
                        .setTitle('Transformed data')
                        .setData(
                          new SceneDataTransformer({
                            transformations: [
                              {
                                id: 'reduce',
                                options: {
                                  reducers: ['last', 'mean'],
                                },
                              },
                            ],
                          })
                        )
                        .build(),
                    }),
                  ],
                }),
              }),
              new SceneFlexItem({
                body: PanelBuilders.stat()
                  .setTitle('Query with predefined transformations')
                  .setData(
                    new SceneDataTransformer({
                      $data: getQueryRunnerWithRandomWalkQuery(),
                      transformations: [
                        {
                          id: 'reduce',
                          options: {
                            reducers: ['mean'],
                          },
                        },
                      ],
                    })
                  )
                  .build(),
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
