import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProvider } from '../core/SceneDataProvider';

export function getNestedScene(): Scene {
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
  const scene = new Scene({
    title: 'Nested Scene demo',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new VizPanel({
          inputParams: { data: dataNode },
          key: '3',
          pluginId: 'timeseries',
          title: 'Panel 3',
        }),
        getInnerScene('Inner scene'),
      ],
    }),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}

export function getInnerScene(title: string) {
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

  const scene = new NestedScene({
    title: title,
    canRemove: true,
    canCollapse: true,
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          inputParams: { data: dataNode },
          key: '3',
          pluginId: 'timeseries',
          title: 'Data',
        }),
      ],
    }),

    actions: [new SceneTimePicker({})],
  });

  return scene;
}
