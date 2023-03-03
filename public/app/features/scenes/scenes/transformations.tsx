import { map, MonoTypeOperatorFunction } from 'rxjs';

import { ArrayVector, DataFrame, DataTransformContext, Field, FieldType } from '@grafana/data';
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
                  title: 'Source data (global query)',
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

                new VizPanel({
                  pluginId: 'timeseries',
                  title: 'Data with a custom transformer (original value * 2)',
                  $data: new SceneDataTransformer({
                    transformations: [multiplyBy2],
                  }),
                }),

                new VizPanel({
                  pluginId: 'stat',
                  title: 'Mixed transformations (original value * 2 and reduced)',
                  $data: new SceneDataTransformer({
                    transformations: [
                      multiplyBy2,
                      {
                        id: 'reduce',
                        options: {
                          reducers: ['last', 'mean'],
                        },
                      },
                    ],
                  }),
                }),
                new VizPanel({
                  pluginId: 'stat',
                  title: 'Mixed transformations (original value *2 and reduced and *2)',
                  $data: new SceneDataTransformer({
                    transformations: [
                      multiplyBy2,
                      {
                        id: 'reduce',
                        options: {
                          reducers: ['last', 'mean'],
                        },
                      },
                      multiplyBy2,
                    ],
                  }),
                }),
              ],
            }),

            new VizPanel({
              $data: getQueryRunnerWithRandomWalkQuery(undefined, {
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
              title: 'Query with predefined std transformations',
            }),

            new VizPanel({
              $data: getQueryRunnerWithRandomWalkQuery(undefined, {
                transformations: [
                  {
                    id: 'reduce',
                    options: {
                      reducers: ['mean'],
                    },
                  },
                  multiplyBy2,
                ],
              }),
              pluginId: 'stat',
              title: 'Query with predefined transformations (std + custom)',
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

const multiplyBy2: (ctx: DataTransformContext) => MonoTypeOperatorFunction<DataFrame[]> = (ctx) => (source) => {
  return source.pipe(
    map((data) => {
      const processed: DataFrame[] = [];

      for (const series of data) {
        const fields: Field[] = [];
        for (const field of series.fields) {
          if (field.type === FieldType.number) {
            fields.push({
              ...field,
              values: new ArrayVector(field.values.toArray().map((v) => v * 2)),
              state: undefined,
            });
          } else {
            fields.push({
              ...field,
              values: new ArrayVector(field.values.toArray()),
              state: undefined,
            });
          }
        }

        processed.push({
          ...series,
          fields,
          length: fields[0].values.length,
        });
      }

      return processed;
    })
  );
};
