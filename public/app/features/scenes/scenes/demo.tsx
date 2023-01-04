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
import { panelBuilders } from '../components/VizPanel/panelBuilders';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getFlexLayoutTest(standalone: boolean): Scene {
  const state = {
    title: 'Flex layout test',
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        panelBuilders.newGraph({
          size: { minWidth: '70%' },
          title: 'Dynamic height and width',
          $data: getQueryRunnerWithRandomWalkQuery({}, { maxDataPointsFromWidth: true }),
        }),
        new SceneFlexLayout({
          direction: 'column',
          children: [
            panelBuilders.newGraph({
              title: 'Fill height',
              options: {},
              fieldConfig: {
                defaults: {
                  custom: {
                    fillOpacity: 20,
                  },
                },
                overrides: [],
              },
            }),
            panelBuilders.newGraph({
              title: 'Fill height',
            }),
            new SceneCanvasText({
              size: { ySizing: 'content' },
              text: 'Size to content',
              fontSize: 20,
              align: 'center',
            }),
            panelBuilders.newGraph({
              title: 'Fixed height',
              size: { height: 300 },
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
