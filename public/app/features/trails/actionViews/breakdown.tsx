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
import { SplittableLayoutItem, VariableTabLayout } from '../VariableTabLayout';

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
      body: new SplittableLayoutItem({
        isSplit: false,
        single: new SceneFlexLayout({
          direction: 'column',
          children: [
            new SceneFlexItem({
              minHeight: 300,
              body: PanelBuilders.timeseries().setTitle('$metric').build(),
            }),
          ],
        }),
        split: new ByFrameRepeater({
          body: new SceneFlexLayout({
            direction: 'column',
            children: [],
          }),
          getLayoutChild: (data, frame, frameIndex) => {
            return new SceneFlexItem({
              minHeight: 200,
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
