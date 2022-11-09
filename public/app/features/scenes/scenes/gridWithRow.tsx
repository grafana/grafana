import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneGridLayout, SceneGridRow } from '../components/layout/SceneGridLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getGridWithRowLayoutTest(): Scene {
  const scene = new Scene({
    title: 'Grid with row layout test',
    layout: new SceneGridLayout({
      children: [
        // new VizPanel({
        //   pluginId: 'timeseries',
        //   title: 'No drag and no resize',
        //   isResizable: false,
        //   isDraggable: false,
        //   size: { x: 12, y: 0, width: 6, height: 10 },
        // }),
        new SceneGridRow({
          title: 'Sample row',
          isCollapsed: true,
          size: { y: 0 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Nested within a row',
              isResizable: true,
              isDraggable: true,
              size: { x: 0, y: 1, width: 12, height: 5 },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Nested within a row',
              isResizable: true,
              isDraggable: true,
              size: { x: 0, y: 5, width: 6, height: 5 },
            }),
          ],
        }),
        new VizPanel({
          isResizable: true,
          isDraggable: true,
          pluginId: 'timeseries',
          title: 'Draggable and resizable',
          size: {
            x: 2,
            y: 11,
            width: 12,
            height: 10,
          },
        }),
        new SceneGridRow({
          title: 'Sample row1',
          isCollapsed: true,
          size: { y: 1 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Nested within a row1',
              isResizable: false,
              isDraggable: true,
              size: { x: 0, y: 0, width: 12, height: 5 },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Nested within a row1',
              isResizable: false,
              isDraggable: true,
              size: { x: 0, y: 5, width: 6, height: 5 },
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
