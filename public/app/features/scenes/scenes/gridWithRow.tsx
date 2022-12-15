import { VizPanel, SceneGridLayout, SceneGridRow } from '../components';
import { EmbeddedScene, Scene } from '../components/Scene';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getGridWithRowLayoutTest(standalone: boolean): Scene {
  const state = {
    title: 'Grid with row layout test',
    layout: new SceneGridLayout({
      children: [
        new SceneGridRow({
          title: 'Row A',
          key: 'Row A',
          isCollapsed: true,
          size: { y: 0 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row A Child1',
              key: 'Row A Child1',
              isResizable: true,
              isDraggable: true,
              size: { x: 0, y: 1, width: 12, height: 5 },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row A Child2',
              key: 'Row A Child2',
              isResizable: true,
              isDraggable: true,
              size: { x: 0, y: 5, width: 6, height: 5 },
            }),
          ],
        }),
        new SceneGridRow({
          title: 'Row B',
          key: 'Row B',
          isCollapsed: true,
          size: { y: 1 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row B Child1',
              key: 'Row B Child1',
              isResizable: false,
              isDraggable: true,
              size: { x: 0, y: 2, width: 12, height: 5 },
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Row B Child2',
              key: 'Row B Child2',
              isResizable: false,
              isDraggable: true,
              size: { x: 0, y: 7, width: 6, height: 5 },
            }),
          ],
        }),
        new VizPanel({
          isResizable: true,
          isDraggable: true,
          pluginId: 'timeseries',
          title: 'Outsider',
          key: 'Outsider',
          size: {
            x: 2,
            y: 12,
            width: 12,
            height: 10,
          },
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}
