import { getDefaultTimeRange } from '@grafana/data';

import { SceneFlexLayout } from '../models/SceneFlexLayout';
import { SceneQueryRunner } from '../models/SceneQueryRunner';
import { SceneTimeRange } from '../models/SceneTimeRange';
import { SceneToolbarButton } from '../models/SceneToolbarButton';
import { VizPanel } from '../models/VizPanel';
import { Scene, ScenePanel } from '../models/scene';

export function getDemoScene(): Scene {
  const scene = new Scene({
    title: 'Hello',
    layout: new SceneFlexLayout({
      direction: 'row',
      size: {},
      children: [
        new ScenePanel({
          key: 'A',
          size: {},
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
              size: {},
              title: 'Panel 3',
            }),
          ],
        }),
      ],
    }),
    context: {
      timeRange: new SceneTimeRange({
        timeRange: getDefaultTimeRange(),
      }),
      data: new SceneQueryRunner({
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
    },
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

  setTimeout(() => {
    scene.setState({
      title: 'New title',
    });
  }, 10000);

  return scene;
}
