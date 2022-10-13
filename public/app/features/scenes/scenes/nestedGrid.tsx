import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneFlexChild, SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneGridCell, SceneGridLayout, SceneGridRow } from '../components/layout/SceneGridLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getGridNestedTest(): Scene {
  const panel = new VizPanel({
    pluginId: 'timeseries',
    title: 'Fill height',
  });

  const row = new SceneGridRow({
    title: 'Nested grid layout',
    size: { x: 0, y: 0, height: 11 },
    children: [
      new SceneGridLayout({
        children: [
          new SceneGridCell({
            size: { x: 0, y: 0, width: 12, height: 10 },
            isResizable: true,
            isDraggable: true,
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'No resize/no drag',
              }),
            ],
          }),
          new SceneGridCell({
            size: { x: 12, y: 0, width: 12, height: 5 },
            isResizable: true,
            isDraggable: true,
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'No resize/no drag',
              }),
            ],
          }),
          new SceneGridCell({
            size: { x: 12, y: 5, width: 12, height: 5 },
            isResizable: true,
            isDraggable: true,
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'No resize/no drag',
              }),
            ],
          }),
        ],
      }),
    ],
  });
  const cell1 = new SceneGridCell({
    isResizable: true,
    isDraggable: true,
    size: {
      x: 0,
      y: 11,
      width: 12,
      height: 10,
    },
    children: [panel],
  });
  const cell2 = new SceneGridCell({
    isResizable: true,
    isDraggable: true,
    size: {
      x: 12,
      y: 11,
      width: 12,
      height: 10,
    },
    children: [panel],
  });

  const scene = new Scene({
    title: 'Grid nested test',
    layout: new SceneGridLayout({
      children: [
        row,
        new SceneGridCell({
          isResizable: false,
          size: {
            x: 0,
            y: 0,
            width: 24,
            height: 10,
          },
          children: [
            new SceneFlexLayout({
              children: [
                new SceneFlexChild({
                  children: [
                    new SceneGridLayout({
                      children: [cell1, cell2],
                    }),
                  ],
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
