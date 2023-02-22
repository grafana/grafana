import {
  VizPanel,
  SceneGridRow,
  SceneTimePicker,
  SceneFlexLayout,
  SceneGridLayout,
  SceneTimeRange,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getGridWithRowsTest(): DashboardScene {
  const panel = new VizPanel({
    pluginId: 'timeseries',
    title: 'Fill height',
  });

  const row1 = new SceneGridRow({
    title: 'Collapsible/draggable row with flex layout',
    placement: { x: 0, y: 0, height: 10 },
    children: [
      new SceneFlexLayout({
        direction: 'row',
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
    ],
  });

  const cell1 = new VizPanel({
    placement: {
      x: 0,
      y: 10,
      width: 12,
      height: 20,
    },
    pluginId: 'timeseries',
    title: 'Cell 1',
  });

  const cell2 = new VizPanel({
    placement: { x: 12, y: 20, width: 12, height: 10, isResizable: false, isDraggable: false },
    pluginId: 'timeseries',
    title: 'No resize/no drag',
  });

  const row2 = new SceneGridRow({
    placement: { x: 12, y: 10, height: 10, width: 12 },
    title: 'Row with a nested flex layout',
    children: [
      new SceneFlexLayout({
        children: [
          new SceneFlexLayout({
            direction: 'column',
            children: [panel, panel],
          }),
          new SceneFlexLayout({
            direction: 'column',
            children: [panel, panel],
          }),
        ],
      }),
    ],
  });

  const scene = new DashboardScene({
    title: 'Grid rows test',
    body: new SceneGridLayout({
      children: [cell1, cell2, row1, row2],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
