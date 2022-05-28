import { getDefaultTimeRange } from '@grafana/data';

import { Scene, ScenePanel } from '../models/Scene';
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
        new ScenePanel({
          key: 'A',
          // size: { vSizing: 'fixed', width: 200 },
          title: 'Panel 1',
        }),
        new SceneFlexLayout({
          key: 'B',
          size: {},
          direction: 'column',
          children: [
            new ScenePanel({
              key: '2',
              size: { hSizing: 'fixed', height: 200 },
              title: 'Panel 2',
            }),
            new VizPanel({
              key: '3',
              pluginId: 'timeseries',
              title: 'Panel 3',
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
          new VizPanel({
            key: '1',
            pluginId: 'timeseries',
            title: 'Title',
            options: {
              legend: { displayMode: 'hidden' },
            },
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
