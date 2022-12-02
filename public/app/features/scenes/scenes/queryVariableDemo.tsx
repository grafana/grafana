import { VariableRefresh } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { QueryVariable } from '../variables/variants/query/QueryVariable';
import { CustomVariable } from '../variables/variants/CustomVariable';

export function getQueryVariableDemo(): Scene {
  const scene = new Scene({
    title: 'Query variable',
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'metric',
          query: 'job : job, instance : instance',
        }),
        new QueryVariable({
          name: 'instance (on time range refresh)',
          refresh: VariableRefresh.onTimeRangeChanged,
          query: { query: 'label_values(go_gc_duration_seconds, ${metric})' },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
        }),
      ],
    }),
    layout: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexLayout({
          children: [
            new SceneCanvasText({
              size: { width: '40%' },
              text: 'job: ${job}',
              fontSize: 20,
              align: 'center',
            }),
          ],
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [new SceneTimePicker({})],
    subMenu: new SceneSubMenu({
      children: [new VariableValueSelectors({})],
    }),
  });

  return scene;
}
