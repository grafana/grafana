import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { ScenePanelRepeater } from '../components/ScenePanelRepeater';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneToolbarInput } from '../components/SceneToolbarButton';
import { VizPanel } from '../components/VizPanel';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getFlexLayoutTest(): Scene {
  const scene = new Scene({
    title: 'Flex layout test',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          size: { minWidth: '70%' },
          pluginId: 'timeseries',
          title: 'Dynamic height and width',
        }),

        new SceneFlexLayout({
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
              size: { ySizing: 'content' },
              text: 'Size to content',
              fontSize: 20,
              align: 'center',
            }),
            new VizPanel({
              size: { height: 300 },
              pluginId: 'timeseries',
              title: 'Fixed height',
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(getDefaultTimeRange()),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });

  return scene;
}

export function getScenePanelRepeaterTest(): Scene {
  const queryRunner = getQueryRunnerWithRandomWalkQuery({
    seriesCount: 2,
    alias: '__server_names',
    scenarioId: 'random_walk',
  });

  const scene = new Scene({
    title: 'Panel repeater test',
    layout: new ScenePanelRepeater({
      layout: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexLayout({
            direction: 'row',
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
