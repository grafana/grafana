import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneFlexLayout } from '../components/SceneFlexLayout';
import { ScenePanelRepeater } from '../components/ScenePanelRepeater';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneToolbarInput } from '../components/SceneToolbarButton';
import { VizPanel } from '../components/VizPanel';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneQueryRunner } from '../querying/SceneQueryRunner';

export function getFlexLayoutTest(): Scene {
  const scene = new Scene({
    title: 'Flex layout test',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Dynamic height and width',
          size: { minWidth: '70%' },
        }),
        new SceneFlexLayout({
          // size: { width: 450 },
          direction: 'column',
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Fill height',
            }),
            new VizPanel({
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
              pluginId: 'timeseries',
              title: 'Fixed height',
              size: { height: 300 },
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    $data: new SceneQueryRunner({
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
    }),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}

export function getScenePanelRepeaterTest(): Scene {
  const queryRunner = new SceneQueryRunner({
    queries: [
      {
        refId: 'A',
        datasource: {
          uid: 'gdev-testdata',
          type: 'testdata',
        },
        seriesCount: 2,
        alias: '__server_names',
        scenarioId: 'random_walk',
      },
    ],
  });

  const scene = new Scene({
    title: 'Panel repeater test',
    layout: new ScenePanelRepeater({
      layout: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexLayout({
            size: { minHeight: 200 },
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Title',
                options: {
                  legend: { displayMode: 'hidden' },
                },
              }),
              new VizPanel({
                size: { width: 300 },
                pluginId: 'stat',
                fieldConfig: { defaults: { displayName: 'Last' }, overrides: [] },
                options: {
                  graphMode: 'none',
                },
              }),
            ],
          }),
        ],
      }),
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    $data: queryRunner,
    actions: [
      new SceneToolbarInput({
        value: '2',
        onChange: (newValue) => {
          queryRunner.setState({
            queries: [
              {
                ...queryRunner.state.queries[0],
                seriesCount: newValue,
              },
            ],
          });
          queryRunner.runQueries();
        },
      }),
      new SceneTimePicker({}),
    ],
  });

  return scene;
}
