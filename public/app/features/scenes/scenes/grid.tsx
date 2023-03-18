import { VizPanel, SceneTimePicker, SceneFlexLayout, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getGridLayoutTest(): DashboardScene {
  return new DashboardScene({
    title: 'Grid layout test',
    body: new SceneGridLayout({
      children: [
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Draggable and resizable',
          placement: {
            x: 0,
            y: 0,
            width: 12,
            height: 10,
            isResizable: true,
            isDraggable: true,
          },
        }),

        new VizPanel({
          pluginId: 'timeseries',
          title: 'No drag and no resize',
          placement: { x: 12, y: 0, width: 12, height: 10, isResizable: false, isDraggable: false },
        }),

        new SceneFlexLayout({
          direction: 'column',
          placement: { x: 6, y: 11, width: 12, height: 10, isDraggable: true, isResizable: true },
          children: [
            new VizPanel({
              placement: { ySizing: 'fill' },
              pluginId: 'timeseries',
              title: 'Child of flex layout',
            }),
            new VizPanel({
              placement: { ySizing: 'fill' },
              pluginId: 'timeseries',
              title: 'Child of flex layout',
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
