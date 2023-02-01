import { VizPanel, SceneGridLayout, SceneGridRow, SceneTimePicker, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getGridWithRowLayoutTest(): DashboardScene {
  return new DashboardScene({
    title: 'Grid with row layout test',
    body: new SceneGridLayout({
      children: [
        new SceneGridRow({
          title: 'Row A',
          key: 'Row A',
          isCollapsed: true,
          placement: { y: 0 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row A Child1',
              key: 'Row A Child1',
              placement: { x: 0, y: 1, width: 12, height: 5, isResizable: true, isDraggable: true },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row A Child2',
              key: 'Row A Child2',
              placement: { x: 0, y: 5, width: 6, height: 5, isResizable: true, isDraggable: true },
            }),
          ],
        }),
        new SceneGridRow({
          title: 'Row B',
          key: 'Row B',
          isCollapsed: true,
          placement: { y: 1 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row B Child1',
              key: 'Row B Child1',
              placement: { x: 0, y: 2, width: 12, height: 5, isResizable: false, isDraggable: true },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row B Child2',
              key: 'Row B Child2',
              placement: { x: 0, y: 7, width: 6, height: 5, isResizable: false, isDraggable: true },
            }),
          ],
        }),
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Outsider',
          key: 'Outsider',
          placement: {
            x: 2,
            y: 12,
            width: 12,
            height: 10,
            isResizable: true,
            isDraggable: true,
          },
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });
}
