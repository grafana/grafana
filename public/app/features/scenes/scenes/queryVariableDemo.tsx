import { VariableRefresh } from '@grafana/data';

import { Scene } from '../components/Scene';
import { SceneCanvasText } from '../components/SceneCanvasText';
import { SceneSubMenu } from '../components/SceneSubMenu';
import { SceneTimePicker } from '../components/SceneTimePicker';
import { SceneFlexLayout } from '../components/layout/SceneFlexLayout';
import { SceneTimeRange } from '../core/SceneTimeRange';
import { VariableValueSelectors } from '../variables/components/VariableValueSelectors';
import { SceneVariableSet } from '../variables/sets/SceneVariableSet';
import { CustomVariable } from '../variables/variants/CustomVariable';
import { DataSourceVariable } from '../variables/variants/DataSourceVariable';
import { QueryVariable } from '../variables/variants/query/QueryVariable';

export function getQueryVariableDemo(): Scene {
  const scene = new Scene({
    title: 'Query variable',
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'metric',
          query: 'job : job, instance : instance',
        }),
        new DataSourceVariable({
          name: 'datasource',
          query: 'prometheus',
        }),
        new QueryVariable({
          name: 'instance (using datasource variable)',
          refresh: VariableRefresh.onTimeRangeChanged,
          query: { query: 'label_values(go_gc_duration_seconds, ${metric})' },
          datasource: '${datasource}',
        }),
        new QueryVariable({
          name: 'label values (on time range refresh)',
          refresh: VariableRefresh.onTimeRangeChanged,
          query: { query: 'label_values(go_gc_duration_seconds, ${metric})' },
          datasource: { uid: 'gdev-prometheus', type: 'prometheus' },
        }),
        new QueryVariable({
          name: 'legacy (graphite)',
          refresh: VariableRefresh.onTimeRangeChanged,
          query: { queryType: 'Default', target: 'stats.response.*' },
          datasource: { uid: 'gdev-graphite', type: 'graphite' },
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
              text: 'metric: ${metric}',
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
