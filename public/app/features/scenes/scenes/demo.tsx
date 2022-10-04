import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { VizPanel } from '../components/VizPanel';
import { SceneDataProvider } from '../core/SceneDataProvider';
import { SceneEditManager } from '../editor/SceneEditManager';

export function getFlexLayoutTest(): Scene {
  const dataNode1 = new SceneDataProvider({
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
    title: 'Flex layout test',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          inputParams: { data: dataNode1 },
          pluginId: 'timeseries',
          title: 'Dynamic height and width',
          size: { minWidth: '70%' },
        }),
        new SceneFlexLayout({
          // size: { width: 450 },
          direction: 'column',
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
            new SceneCanvasText({
              text: 'Size to content',
              fontSize: 20,
              size: { ySizing: 'content' },
              align: 'center',
            }),
            new VizPanel({
              inputParams: { data: dataNode1 },
              pluginId: 'timeseries',
              title: 'Fixed height',
              size: { height: 300 },
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}
