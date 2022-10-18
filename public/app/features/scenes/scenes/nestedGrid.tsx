import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneGridLayout, SceneGridRow } from '../components/layout/SceneGridLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getGridNestedTest(): Scene {
  const row = new SceneGridRow({
    title: 'Nested grid layout',
    size: { x: 0, y: 0, height: 11 },
    children: [
      new SceneGridLayout({
        children: [
          new VizPanel({
            size: { x: 0, y: 0, width: 12, height: 10 },
            isDraggable: true,
            pluginId: 'timeseries',
            title: 'Test Panel',
          }),
          new VizPanel({
            size: { x: 12, y: 0, width: 12, height: 5 },
            isDraggable: true,
            pluginId: 'timeseries',
            title: 'Test Panel',
          }),
          new VizPanel({
            isDraggable: true,
            size: { x: 12, y: 5, width: 12, height: 5 },
            pluginId: 'timeseries',
            title: 'Test Panel',
          }),
        ],
      }),
    ],
  });

  const cell1 = new VizPanel({
    size: {
      x: 0,
      y: 11,
      width: 12,
      height: 10,
    },
    isDraggable: true,
    pluginId: 'timeseries',
    title: 'Cell 1',
  });

  const cell2 = new VizPanel({
    size: {
      x: 12,
      y: 11,
      width: 12,
      height: 10,
    },
    isDraggable: true,
    pluginId: 'timeseries',
    title: 'Cell 1',
  });

  const scene = new Scene({
    title: 'Grid nested test',
    layout: new SceneGridLayout({
      children: [
        row,
        new SceneGridLayout({
          size: {
            x: 0,
            y: 0,
            width: 24,
            height: 10,
          },
          children: [cell1, cell2],
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
