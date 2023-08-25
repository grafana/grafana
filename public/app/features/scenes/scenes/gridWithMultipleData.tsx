import {
  SceneGridRow,
  SceneTimePicker,
  SceneGridLayout,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneGridItem,
  PanelBuilders,
} from '@grafana/scenes';
import { TestDataQueryType } from 'app/plugins/datasource/testdata/dataquery.gen';

import { DashboardScene } from '../dashboard/DashboardScene';

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
          y: 0,
          children: [
            new SceneGridItem({
              x: 0,
              y: 1,
              width: 12,
              height: 5,
              isResizable: true,
              isDraggable: true,
              body: PanelBuilders.timeseries().setTitle('Row A Child1').build(),
            }),
            new SceneGridItem({
              x: 0,
              y: 5,
              width: 6,
              height: 5,
              isResizable: true,
              isDraggable: true,
              body: PanelBuilders.timeseries().setTitle('Row A Child2').build(),
            }),
          ],
        }),
        new SceneGridRow({
          title: 'Row B - uses global query',
          key: 'Row B',
          isCollapsed: true,
          y: 1,
          children: [
            new SceneGridItem({
              x: 0,
              y: 2,
              width: 12,
              height: 5,
              isResizable: false,
              isDraggable: true,
              body: PanelBuilders.timeseries().setTitle('Row B Child1').build(),
            }),
            new SceneGridItem({
              x: 0,
              y: 7,
              width: 6,
              height: 5,
              isResizable: false,
              isDraggable: true,
              body: PanelBuilders.timeseries()
                .setTitle('Row B Child2 with data')
                .setData(getQueryRunnerWithRandomWalkQuery({ seriesCount: 10 }))
                .build(),
            }),
          ],
        }),
        new SceneGridItem({
          x: 0,
          y: 12,
          width: 6,
          height: 10,
          isResizable: true,
          isDraggable: true,
          body: PanelBuilders.timeseries()
            .setTitle('Outsider, has its own query')
            .setData(getQueryRunnerWithRandomWalkQuery({ seriesCount: 10 }))
            .build(),
        }),
        new SceneGridItem({
          x: 6,
          y: 12,
          width: 12,
          height: 10,
          isResizable: true,
          isDraggable: true,
          body: PanelBuilders.timeseries().setTitle('Outsider, uses global query').build(),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({}), new SceneRefreshPicker({})],
  });
}
