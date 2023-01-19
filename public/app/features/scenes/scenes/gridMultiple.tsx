import { VizPanel, SceneTimePicker, SceneFlexLayout, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getMultipleGridLayoutTest(): DashboardScene {
  return new DashboardScene({
    title: 'Multiple grid layouts test',
    body: new SceneFlexLayout({
      children: [
        new SceneGridLayout({
          children: [
            new VizPanel({
              placement: {
                x: 0,
                y: 0,
                width: 12,
                height: 10,
                isDraggable: true,
                isResizable: true,
              },
              pluginId: 'timeseries',
              title: 'Dragabble and resizable',
            }),
            new VizPanel({
              placement: { x: 12, y: 0, width: 12, height: 10, isResizable: false, isDraggable: true },
              pluginId: 'timeseries',
              title: 'Draggable only',
            }),
            new SceneFlexLayout({
              placement: { x: 6, y: 11, width: 12, height: 10, isResizable: false, isDraggable: true },
              direction: 'column',
              children: [
                new VizPanel({
                  placement: { ySizing: 'fill' },
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
                new VizPanel({
                  placement: { ySizing: 'fill' },
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
              ],
            }),
          ],
        }),

        new SceneGridLayout({
          children: [
            new VizPanel({
              placement: {
                x: 0,
                y: 0,
                width: 12,
                height: 10,
                isDraggable: true,
              },
              pluginId: 'timeseries',
              title: 'Fill height',
            }),
            new VizPanel({
              placement: { x: 12, y: 0, width: 12, height: 10, isResizable: false, isDraggable: true },
              pluginId: 'timeseries',
              title: 'Fill height',
            }),
            new SceneFlexLayout({
              placement: { x: 6, y: 11, width: 12, height: 10 },
              direction: 'column',
              children: [
                new VizPanel({
                  placement: { ySizing: 'fill', isDraggable: true },
                  pluginId: 'timeseries',
                  title: 'Fill height',
                }),
                new VizPanel({
                  placement: { ySizing: 'fill', isDraggable: true },
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
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });
}
