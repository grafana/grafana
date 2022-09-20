import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getScene(): Scene {
  const scene = new Scene({
    title: 'Nested Scene demo (isolated)',
    $editor: new SceneEditManager({}),
    children: [
      new SceneFlexLayout({
        direction: 'column',
        children: [getInnerScene('Inner scene')],
      }),
    ],
  });

  return scene;
}

export function getInnerScene(title: string) {
  const timeRangeNode = new SceneTimeRange({
    range: getDefaultTimeRange(),
  });

  const dataProviderNode = new SceneDataProviderNode({
    inputParams: {
      timeRange: timeRangeNode,
    },
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        scenarioId: 'random_walk_table',
      },
    ],
  });

  const scene = new NestedScene({
    title: title,
    canCollapse: true,
    canRemove: true,
    isCollapsed: false,
    actions: [new SceneTimePicker({ inputParams: { timeRange: timeRangeNode } })],
    children: [
      new SceneFlexLayout({
        direction: 'row',
        children: [
          new SceneFlexChild({
            children: [
              new VizPanel({
                inputParams: {
                  data: dataProviderNode,
                },
                key: '3',
                pluginId: 'timeseries',
                title: 'Data',
              }),
            ],
          }),
          new SceneFlexChild({
            children: [
              new VizPanel({
                inputParams: {
                  data: dataProviderNode,
                },
                key: '3',
                pluginId: 'timeseries',
                title: 'Data',
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return scene;
}

export const basicNestedScene = {
  title: 'Nested Scene demo (nested scene only)',
  getScene,
};
