import { VariableRefresh } from '@grafana/data';
import {
  SceneCanvasText,
  SceneSubMenu,
  SceneTimePicker,
  SceneFlexLayout,
  SceneTimeRange,
  VariableValueSelectors,
  SceneVariableSet,
  CustomVariable,
  DataSourceVariable,
  QueryVariable,
  EmbeddedScene,
} from '@grafana/scenes';

import { Scene } from '../components/Scene';

export function getQueryVariableDemo(standalone: boolean): Scene | EmbeddedScene {
  const state = {
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
        new SceneFlexLayout({
          children: [
            new SceneCanvasText({
              placement: { width: '40%' },
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
  };

  return standalone ? new Scene(state) : new EmbeddedScene(state);
}
