import { VariableRefresh } from '@grafana/data';
import {
  SceneCanvasText,
  SceneTimePicker,
  SceneFlexLayout,
  SceneTimeRange,
  VariableValueSelectors,
  SceneVariableSet,
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  SceneRefreshPicker,
  SceneFlexItem,
} from '@grafana/scenes';

import { DashboardScene } from '../dashboard/DashboardScene';

export function getQueryVariableDemo(): DashboardScene {
  return new DashboardScene({
    title: 'Query variable',
    $variables: new SceneVariableSet({
      variables: [
        new CustomVariable({
          name: 'metric',
          query: 'job : job, instance : instance',
        }),
        new DataSourceVariable({
          name: 'datasource',
          pluginId: 'prometheus',
        }),
        new QueryVariable({
          name: 'instance (using datasource variable)',
          refresh: VariableRefresh.onTimeRangeChanged,
          query: { query: 'label_values(go_gc_duration_seconds, ${metric})' },
          datasource: { uid: '${datasource}' },
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
    body: new SceneFlexLayout({
      direction: 'row',
      children: [
        new SceneFlexItem({
          width: '40%',
          body: new SceneCanvasText({
            text: 'metric: ${metric}',
            fontSize: 20,
            align: 'center',
          }),
        }),
      ],
    }),
    $timeRange: new SceneTimeRange(),
    actions: [new SceneTimePicker({}), new SceneRefreshPicker({})],
    controls: [new VariableValueSelectors({})],
  });
}
