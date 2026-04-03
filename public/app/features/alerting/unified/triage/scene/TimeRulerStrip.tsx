import { css } from '@emotion/css';
import { useMemo } from 'react';

import { FieldType, type GrafanaTheme2, LoadingState } from '@grafana/data';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { useTimeRange, VizPanel } from '@grafana/scenes-react';
import { AxisPlacement, GraphDrawStyle, LegendDisplayMode, TooltipDisplayMode, VisibilityMode } from '@grafana/schema';
import { useStyles2 } from '@grafana/ui';

const RULER_HEIGHT = 40;

export const timeRulerVizConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Line)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 0)
  .setCustomFieldConfig('hideFrom', { legend: true, tooltip: true, viz: true })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setOption('tooltip', { mode: TooltipDisplayMode.None })
  .setMin(0)
  .setMax(1)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('Value')
      .overrideCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
      .overrideCustomFieldConfig('axisGridShow', false)
  )
  .build();

export function TimeRulerStrip() {
  const styles = useStyles2(getStyles);
  const [timeRange] = useTimeRange();

  const dataProvider = useMemo(
    () =>
      new SceneDataNode({
        data: {
          series: [
            {
              fields: [
                { name: 'Time', type: FieldType.time, values: [timeRange.from.valueOf(), timeRange.to.valueOf()], config: {} },
                { name: 'Value', type: FieldType.number, values: [0, 0], config: {} },
              ],
              length: 2,
            },
          ],
          state: LoadingState.Done,
          timeRange,
        },
      }),
    [timeRange]
  );

  return (
    <div className={styles.container}>
      <VizPanel
        title=""
        viz={timeRulerVizConfig}
        dataProvider={dataProvider}
        displayMode="transparent"
        hoverHeader={true}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      height: RULER_HEIGHT,
      paddingLeft: 5,
      paddingRight: 5,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      pointerEvents: 'none',
    }),
  };
}
