import { VizPanel, SceneGridRow, SceneTimePicker, SceneGridLayout, SceneTimeRange } from '@grafana/scenes';
import { TestDataQueryType } from 'app/plugins/datasource/testdata/dataquery.gen';

import { DashboardScene } from '../dashboard/DashboardScene';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getGridWithMultipleData(): DashboardScene {
  return new DashboardScene({
    title: 'Grid with rows and different queries',
    body: new SceneGridLayout({
      children: [
        new SceneGridRow({
          $timeRange: new SceneTimeRange(),
          $data: getQueryRunnerWithRandomWalkQuery({ scenarioId: TestDataQueryType.RandomWalkTable }),
          title: 'Row A - has its own query',
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
          title: 'Row B - uses global query',
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
              $data: getQueryRunnerWithRandomWalkQuery({ seriesCount: 10 }),
              pluginId: 'timeseries',
              title: 'Row B Child2 with data',
              key: 'Row B Child2',
              placement: { x: 0, y: 7, width: 6, height: 5, isResizable: false, isDraggable: true },
            }),
          ],
        }),
        new VizPanel({
          $data: getQueryRunnerWithRandomWalkQuery({ seriesCount: 10 }),
          pluginId: 'timeseries',
          title: 'Outsider, has its own query',
          key: 'Outsider-own-query',
          placement: {
            x: 0,
            y: 12,
            width: 6,
            height: 10,
            isResizable: true,
            isDraggable: true,
          },
        }),
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Outsider, uses global query',
          key: 'Outsider-global-query',
          placement: {
            x: 6,
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
