import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
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

  const scene = new Scene({
    $editor: new SceneEditManager({}),
    title: 'Minimal example: Data + viz',
    children: [
      new SceneTimePicker({ inputParams: { timeRange: timeRangeNode1 } }),
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
  });

  return scene;
}

export const demo = {
  title: 'Minimal example: Data + viz',
  getScene,
};
