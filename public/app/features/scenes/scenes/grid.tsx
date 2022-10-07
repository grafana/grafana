import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneGridCell, SceneGridLayout } from '../components/SceneGridLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getGridLayoutTest(): Scene {
  const scene = new Scene({
    title: 'Grid layout test',
    layout: new SceneGridLayout({
      children: [
        new SceneGridCell({
          isResizable: true,
          isDraggable: true,
          size: {
            x: 0,
            y: 0,
            width: 12,
            height: 10,
          },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Fill height',
            }),
          ],
        }),
        new SceneGridCell({
          isResizable: false,
          isDraggable: false,
          size: { x: 12, y: 0, width: 12, height: 10 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Fill height',
            }),
          ],
        }),
        new SceneGridCell({
          isResizable: true,
          isDraggable: true,
          size: { x: 6, y: 11, width: 12, height: 10 },
          children: [
            new SceneFlexLayout({
              direction: 'column',
              size: { height: '100%' },
              children: [
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
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    $data: new SceneQueryRunner({
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
    }),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
