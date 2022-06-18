import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../models/Scene';
import { SceneCanvasText } from '../models/SceneCanvasText';
import { SceneFlexLayout } from '../models/SceneFlexLayout';
import { ScenePanelRepeater } from '../models/ScenePanelRepeater';
import { SceneQueryRunner } from '../models/SceneQueryRunner';
import { SceneTimeRange } from '../models/SceneTimeRange';
import { SceneToolbarButton, SceneToolbarInput } from '../models/SceneToolbarButton';
import { VizPanel } from '../models/VizPanel';

export function getFlexLayoutTest(): Scene {
  const scene = new Scene({
    title: 'Flex layout test',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          pluginId: 'timeseries',
          title: 'Dynamic height and width',
        }),
        new SceneFlexLayout({
          key: 'B',
          size: { width: 450 },
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
    $timeRange: new SceneTimeRange({
      timeRange: getDefaultTimeRange(),
    }),
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
    actions: [
      new SceneToolbarButton({
        icon: 'columns',
        onClick: () => {
          scene.setState({ isEditing: !scene.state.isEditing });
          // (scene.state.layout as SceneFlexLayout).toggleDirection();
        },
      }),
    ],
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
        seriesCount: 5,
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
    $timeRange: new SceneTimeRange({
      timeRange: getDefaultTimeRange(),
    }),
    $data: queryRunner,
    actions: [
      new SceneToolbarInput({
        value: '5',
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
    ],
  });

  return scene;
}
