import { getFrameDisplayName } from '@grafana/data';
import {
  SceneFlexLayout,
  SceneTimeRange,
  SceneTimePicker,
  SceneByFrameRepeater,
  VizPanel,
  SceneCanvasText,
  SceneToolbarInput,
  SceneDataNode,
} from '@grafana/scenes';
import { TestDataQueryType } from 'app/plugins/datasource/testdata/dataquery.gen';

import { panelBuilders } from '../builders/panelBuilders';
import { DashboardScene } from '../dashboard/DashboardScene';
import { SceneEditManager } from '../editor/SceneEditManager';

import { getQueryRunnerWithRandomWalkQuery } from './queries';

export function getFlexLayoutTest(): DashboardScene {
  return new DashboardScene({
    title: 'Flex layout test',
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        panelBuilders.newGraph({
          placement: { minWidth: '70%' },
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
              placement: { ySizing: 'content' },
              text: 'Size to content',
              fontSize: 20,
              align: 'center',
            }),
            panelBuilders.newGraph({
              title: 'Fixed height',
              placement: { height: 300 },
            }),
          ],
        }),
      ],
    }),
    $editor: new SceneEditManager({}),
    $timeRange: new SceneTimeRange(),
    $data: getQueryRunnerWithRandomWalkQuery(),
    actions: [new SceneTimePicker({})],
  });
}

export function getScenePanelRepeaterTest(): DashboardScene {
  const queryRunner = getQueryRunnerWithRandomWalkQuery({
    seriesCount: 2,
    alias: '__server_names',
    scenarioId: TestDataQueryType.RandomWalk,
  });

  return new DashboardScene({
    title: 'Panel repeater test',
    body: new SceneByFrameRepeater({
      body: new SceneFlexLayout({
        direction: 'column',
        children: [],
      }),
      getLayoutChild: (data, frame, frameIndex) => {
        return new SceneFlexLayout({
          key: `panel-${frameIndex}`,
          $data: new SceneDataNode({
            data: {
              ...data,
              series: [frame],
            },
          }),
          direction: 'row',
          placement: { minHeight: 200 },
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              title: getFrameDisplayName(frame),
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
        });
      },
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
  });
}

export function getRepeaterSceneWithFlexWrap(): DashboardScene {
  const queryRunner = getQueryRunnerWithRandomWalkQuery({
    seriesCount: 10,
    alias: '__server_names',
    scenarioId: TestDataQueryType.RandomWalk,
  });

  return new DashboardScene({
    title: 'Flex layout with wrap test',
    body: new SceneByFrameRepeater({
      body: new SceneFlexLayout({
        direction: 'row',
        wrap: 'wrap',
        children: [],
      }),
      getLayoutChild: (data, frame, frameIndex) => {
        return new VizPanel({
          pluginId: 'timeseries',
          title: getFrameDisplayName(frame),
          $data: new SceneDataNode({
            data: {
              ...data,
              series: [frame],
            },
          }),
          placement: { height: 300, minWidth: 400 },
          options: {
            legend: { displayMode: 'hidden' },
          },
        });
      },
    }),
    $timeRange: new SceneTimeRange(),
    $data: queryRunner,
    actions: [
      new SceneToolbarInput({
        value: '10',
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
}
