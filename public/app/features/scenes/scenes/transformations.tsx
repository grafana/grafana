import { Scene, SceneTimePicker, SceneFlexLayout, VizPanel } from '../components';
import { EmbeddedScene } from '../components/Scene';
import { SceneDataTransformer } from '../core/SceneDataTransformer';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getTransformationsDemo(standalone: boolean): Scene {
  const state = {
    title: 'Transformations demo',
    layout: new SceneFlexLayout({
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
              title: 'Query with predefined transformations',
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}
