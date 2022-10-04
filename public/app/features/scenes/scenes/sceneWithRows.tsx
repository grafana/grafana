import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProvider } from '../core/SceneDataProvider';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getSceneWithRows(): Scene {
  const dataNode = new SceneDataProvider({
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
  });

  const dataNode1 = new SceneDataProvider({
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

  const scene = new Scene({
    title: 'Scene with rows',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new NestedScene({
          title: 'Overview (uses global context)',
          canCollapse: true,
          inheritContext: true,
          layout: new SceneFlexLayout({
            direction: 'row',
            children: [
              new VizPanel({
                inputParams: { data: dataNode },
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
              new VizPanel({
                inputParams: { data: dataNode },
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
            ],
          }),
        }),
        new NestedScene({
          title: 'More server details',
          canCollapse: true,
          actions: [new SceneTimePicker({})],
          layout: new SceneFlexLayout({
            direction: 'row',
            children: [
              new VizPanel({
                inputParams: { data: dataNode1 },
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
              new VizPanel({
                inputParams: { data: dataNode1 },
                pluginId: 'timeseries',
                title: 'Fill height',
              }),
            ],
          }),
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
