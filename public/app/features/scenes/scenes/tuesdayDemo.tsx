import { Scene, SceneTimePicker, SceneFlexLayout, VizPanel } from '../components';
import { BigText } from '../components/BigText';
import { EmbeddedScene } from '../components/Scene';
import { SceneTimeRange } from '../core/SceneTimeRange';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getTuesdayDemo(standalone: boolean): Scene {
  const state = {
    title: 'Tuesday demo',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Fill height',
        }),
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Fill height',
        }),
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Fill height',
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}

// new SceneFlexLayout({
//   direction: 'row',
//   children: [
//     new VizPanel({
//       pluginId: 'timeseries',
//       title: 'Fill height',
//     }),
//   ],
// }),

// new BigText({
//   text: 'Tuesday demo',
//   fontSize: 20,
// })
