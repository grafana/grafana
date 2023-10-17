import { getFrameDisplayName } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  SceneVariableSet,
  PanelBuilders,
  QueryVariable,
  SceneDataNode,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
} from '@grafana/scenes';

import { AddToFiltersGraphAction } from '../AddToFiltersGraphAction';
import { ByFrameRepeater } from '../ByFrameRepeater';
import { LayoutSwitcher } from '../LayoutSwitcher';
import { VariableTabLayout } from '../VariableTabLayout';

export function buildBreakdownActionScene() {
  return new SceneFlexItem({
    body: new VariableTabLayout({
      $variables: new SceneVariableSet({
        variables: [
          new QueryVariable({
            name: 'groupby',
            label: 'Group by',
            datasource: { uid: 'gdev-prometheus' },
            query: { query: 'label_names(${metric})', refId: 'A' },
            value: '',
            text: '',
          }),
        ],
      }),
      variableName: 'groupby',
      $data: new SceneQueryRunner({
        queries: [
          {
            refId: 'A',
            datasource: { uid: 'gdev-prometheus' },
            expr: 'sum(rate(${metric}{${filters}}[$__rate_interval])) by($groupby)',
          },
        ],
      }),
      body: new LayoutSwitcher({
        active: 'grid',
        single: new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle('$metric').build(),
            }),
          ],
        }),
        rows: new ByFrameRepeater({
          body: new SceneFlexLayout({
            direction: 'column',
            children: [],
          }),
          getLayoutChild: (data, frame, frameIndex) => {
            return new SceneFlexItem({
              minHeight: 180,
              body: PanelBuilders.timeseries()
                .setTitle(getFrameDisplayName(frame, frameIndex))
                .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
                .setOption('legend', { showLegend: false })
                .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
                .setCustomFieldConfig('fillOpacity', 9)
                .setHeaderActions(new AddToFiltersGraphAction({ frame }))
                .build(),
            });
          },
        }),
        grid: new ByFrameRepeater({
          body: new SceneFlexLayout({
            direction: 'row',
            children: [],
            wrap: 'wrap',
          }),
          getLayoutChild: (data, frame, frameIndex) => {
            return new SceneFlexItem({
              minHeight: 180,
              minWidth: 350,
              body: PanelBuilders.timeseries()
                .setTitle(getFrameDisplayName(frame, frameIndex))
                .setData(new SceneDataNode({ data: { ...data, series: [frame] } }))
                .setOption('legend', { showLegend: false })
                .setColor({ mode: 'fixed', fixedColor: getColorByIndex(frameIndex) })
                .setCustomFieldConfig('fillOpacity', 9)
                .setHeaderActions(new AddToFiltersGraphAction({ frame }))
                .build(),
            });
          },
        }),
      }),
    }),
  });
}

function getColorByIndex(index: number) {
  const visTheme = config.theme2.visualization;
  return visTheme.getColorByName(visTheme.palette[index % 5]);
}
