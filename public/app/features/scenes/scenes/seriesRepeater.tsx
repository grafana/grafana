import { Scene } from '../components/Scene';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { ScenePanelRepeater } from '../components/ScenePanelRepeater';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneToolbarInput } from '../components/SceneToolbarButton';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProvider } from '../core/SceneDataProvider';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getScenePanelRepeaterTest(): Scene {
  const dataNode1 = new SceneDataProvider({
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        scenarioId: 'random_walk',
        seriesCount: 2,
      },
    ],
  });

  const scene = new Scene({
    title: 'Panel repeater test',
    layout: new SceneFlexLayout({
      direction: 'column',
      children: [
        new ScenePanelRepeater({
          $data: dataNode1,
          panel: new VizPanel({
            $data: null,
            title: 'Title',
            pluginId: 'timeseries',
            options: {
              legend: { displayMode: 'hidden' },
            },
          }),
          layout: new SceneFlexLayout({
            direction: 'row',
            size: { minHeight: 200 },
            children: [],
          }),
        }),
        new VizPanel({
          $data: dataNode1,
          title: 'Non-split series',
          pluginId: 'timeseries',
        }),
      ],
    }),

    actions: [
      new SceneToolbarInput({
        value: '2',
        onChange: (newValue) => {
          dataNode1.setState({
            queries: [
              {
                ...dataNode1.state.queries[0],
                seriesCount: newValue,
              },
            ],
          });
        },
      }),
      new SceneTimePicker({}),
    ],
    $editor: new SceneEditManager({}),
  });

  return scene;
}
