import { getDefaultTimeRange } from '@grafana/data';

import { Scene } from '../models/Scene';
import { SceneFlexLayout } from '../models/SceneFlexLayout';
import { ScenePanelRepeater } from '../models/ScenePanelRepeater';
import { SceneQueryRunner } from '../models/SceneQueryRunner';
import { SceneTimeRange } from '../models/SceneTimeRange';
import { SceneToolbarButton } from '../models/SceneToolbarButton';
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
          size: { hSizing: 'fixed', width: 450 },
          direction: 'column',
          children: [
            new VizPanel({
              pluginId: 'timeseries',
              size: { vSizing: 'fixed', height: 300 },
              title: 'Fixed height',
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Dynamic height',
            }),
            new VizPanel({
              pluginId: 'timeseries',
              title: 'Dynamic height',
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
          scene.state.layout.setState({
            direction: scene.state.layout.state.direction === 'row' ? 'column' : 'row',
          });
        },
      }),
    ],
  });

  return scene;
}

export function getScenePanelRepeaterTest(): Scene {
  const scene = new Scene({
    title: 'Panel repeater test',
    layout: new ScenePanelRepeater({
      layout: new SceneFlexLayout({
        direction: 'column',
        children: [
          new SceneFlexLayout({
            children: [
              new VizPanel({
                key: '1',
                pluginId: 'timeseries',
                title: 'Title',
                options: {
                  legend: { displayMode: 'hidden' },
                },
              }),
              new VizPanel({
                key: '1',
                size: { hSizing: 'fixed', width: 300 },
                pluginId: 'gauge',
                title: 'Title',
                options: {},
              }),
            ],
          }),
        ],
      }),
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
          seriesCount: 5,
          alias: '__server_names',
          scenarioId: 'random_walk',
        },
      ],
    }),
    actions: [
      new SceneToolbarButton({
        icon: 'columns',
        onClick: () => {
          scene.state.layout.setState({
            direction: scene.state.layout.state.direction === 'row' ? 'column' : 'row',
          });
        },
      }),
    ],
  });

  return scene;
}

// {
//           refId: 'A',
//           datasource: {
//             uid: 'gdev-prometheus',
//             type: 'prometheus',
//           },
//           expr: 'sum(rate(grafana_http_request_duration_seconds_count{job="grafana"}[$__rate_interval]))'
//         },
