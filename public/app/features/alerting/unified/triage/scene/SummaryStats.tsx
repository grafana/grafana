import { VizOrientation } from '@grafana/data';
import { SceneObjectBase, SceneObjectState, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel, useQueryRunner } from '@grafana/scenes-react';
import { LegendDisplayMode } from '@grafana/ui';

import { overrideToFixedColor } from '../../home/Insights';
import { METRIC_NAME } from '../constants';

import { getDataQuery, useQueryFilter } from './utils';

const summaryStatVizConfig = VizConfigBuilders.bargauge()
  .setOption('orientation', VizOrientation.Horizontal)
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setMin(0)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function SummaryStatsReact() {
  const filter = useQueryFilter();

  const dataProvider = useQueryRunner({
    queries: [
      getDataQuery(`count by (alertstate) (${METRIC_NAME}{${filter}})`, {
        legendFormat: '{{alertstate}}', // we need this so wgite can map states to the correct color in the vizConfig
        instant: true,
        exemplar: false,
      }),
    ],
  });

  return <VizPanel title="" viz={summaryStatVizConfig} dataProvider={dataProvider} hoverHeader={true} />;
}

// simple wrapper so we can render the Chart using a Scene parent
export class SummaryStatsScene extends SceneObjectBase<SceneObjectState> {
  static Component = SummaryStatsReact;
}
