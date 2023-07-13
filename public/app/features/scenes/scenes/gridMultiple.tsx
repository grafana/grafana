import {
  SceneTimePicker,
  SceneFlexLayout,
  SceneGridLayout,
  SceneTimeRange,
  SceneRefreshPicker,
  SceneGridItem,
  SceneFlexItem,
  PanelBuilders,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getMultipleGridLayoutTest(): DashboardScene {
  return new DashboardScene({
    title: 'Multiple grid layouts test',
    body: new SceneFlexLayout({
      children: [
        new SceneFlexItem({
          body: new SceneGridLayout({
            children: [
              new SceneGridItem({
                x: 0,
                y: 0,
                width: 12,
                height: 10,
                isDraggable: true,
                isResizable: true,
                body: PanelBuilders.timeseries().setTitle('Dragabble and resizable').build(),
              }),
              new SceneGridItem({
                x: 12,
                y: 0,
                width: 12,
                height: 10,
                isResizable: false,
                isDraggable: true,
                body: PanelBuilders.timeseries().setTitle('Draggable only').build(),
              }),
              new SceneGridItem({
                x: 6,
                y: 11,
                width: 12,
                height: 10,
                isResizable: false,
                isDraggable: true,
                body: new SceneFlexLayout({
                  direction: 'column',
                  children: [
                    new SceneFlexItem({
                      ySizing: 'fill',
                      body: PanelBuilders.timeseries().setTitle('Fill height').build(),
                    }),
                    new SceneFlexItem({
                      ySizing: 'fill',
                      body: PanelBuilders.timeseries().setTitle('Fill height').build(),
                    }),
                  ],
                }),
              }),
            ],
          }),
        }),
        new SceneFlexItem({
          body: new SceneGridLayout({
            children: [
              new SceneGridItem({
                x: 0,
                y: 0,
                width: 12,
                height: 10,
                isDraggable: true,
                isResizable: true,
                body: PanelBuilders.timeseries().setTitle('Dragabble and resizable').build(),
              }),
              new SceneGridItem({
                x: 12,
                y: 0,
                width: 12,
                height: 10,
                isResizable: false,
                isDraggable: true,
                body: PanelBuilders.timeseries().setTitle('Draggable only').build(),
              }),
              new SceneGridItem({
                x: 6,
                y: 11,
                width: 12,
                height: 10,
                isResizable: false,
                isDraggable: true,
                body: new SceneFlexLayout({
                  direction: 'column',
                  children: [
                    new SceneFlexItem({
                      ySizing: 'fill',
                      body: PanelBuilders.timeseries().setTitle('Fill height').build(),
                    }),
                    new SceneFlexItem({
                      ySizing: 'fill',
                      body: PanelBuilders.timeseries().setTitle('Fill height').build(),
                    }),
                  ],
                }),
              }),
            ],
          }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({}), new SceneRefreshPicker({})],
  });
}
