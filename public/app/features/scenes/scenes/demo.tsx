import {
  Scene,
  SceneCanvasText,
  ScenePanelRepeater,
  SceneTimePicker,
  SceneToolbarInput,
  SceneFlexLayout,
  VizPanel,
} from '../components';
import { EmbeddedScene } from '../components/Scene';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getFlexLayoutTest(standalone: boolean): Scene {
  const state = {
    title: 'Flex layout test',
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new VizPanel({
          placement: { minWidth: '70%' },
          pluginId: 'timeseries',
          title: 'Dynamic height and width',
          $data: getQueryRunnerWithRandomWalkQuery({}, { maxDataPointsFromWidth: true }),
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
              placement: { ySizing: 'content' },
              text: 'Size to content',
              fontSize: 20,
              align: 'center',
            }),
            new VizPanel({
              placement: { height: 300 },
              pluginId: 'timeseries',
              title: 'Fixed height',
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}

export function getScenePanelRepeaterTest(standalone: boolean): Scene {
  const queryRunner = getQueryRunnerWithRandomWalkQuery({
    seriesCount: 2,
    alias: '__server_names',
    scenarioId: 'random_walk',
  });

  const state = {
    title: 'Panel repeater test',
    body: new ScenePanelRepeater({
      layout: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexLayout({
            direction: 'row',
            placement: { minHeight: 200 },
            children: [
              new VizPanel({
                pluginId: 'timeseries',
                title: 'Title',
                options: {
                  legend: { displayMode: 'hidden' },
                },
              }),
              new VizPanel({
                placement: { width: 300 },
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
    $timeRange: new SceneTimeRange(),
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
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}
