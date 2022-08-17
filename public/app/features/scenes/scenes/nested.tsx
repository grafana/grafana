import { getDefaultTimeRange } from '@grafana/data';

import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { Orientation, SceneToolboxLayout } from '../components/SceneToolboxLayout';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
import { SceneTimeRange } from '../core/SceneTimeRange';

export function getNestedScene(): Scene {
  const scene = new Scene({
    title: 'Nested Scene demo',
    children: [
      new SceneToolboxLayout({
        orientation: Orientation.Vertical,
        children: [
          new SceneTimeRange({
            showInToolbox: true,
            range: getDefaultTimeRange(),
            children: [
              new SceneDataProviderNode({
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
                children: [
                  new SceneFlexLayout({
                    direction: 'column',
                    children: [
                      new VizPanel({
                        key: '3',
                        pluginId: 'timeseries',
                        title: 'Panel 3',
                      }),
                      getInnerScene('Inner scene'),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return scene;
}

export function getInnerScene(title: string) {
  const scene = new NestedScene({
    title: title,
    canCollapse: true,
    isCollapsed: false,
    children: [
      new SceneTimeRange({
        showInToolbox: true,
        range: getDefaultTimeRange(),
        children: [
          new SceneDataProviderNode({
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
            children: [
              new SceneFlexLayout({
                direction: 'column',
                children: [
                  new VizPanel({
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                  }),
                  new VizPanel({
                    key: '3',
                    pluginId: 'timeseries',
                    title: 'Data',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
    // $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    // $data: new SceneQueryRunner({
    //   queries: [
    //     {
    //       refId: 'A',
    //       datasource: {
    //         uid: 'gdev-testdata',
    //         type: 'testdata',
    //       },
    //       scenarioId: 'random_walk',
    //     },
    //   ],
    // }),
    // actions: [new SceneTimePicker({})],
  });

  return scene;
}
