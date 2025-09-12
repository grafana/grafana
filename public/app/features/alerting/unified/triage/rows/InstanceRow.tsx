import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import { useMemo } from 'react';

import { DataFrame, GrafanaTheme2, Labels, LoadingState, TimeRange } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { SceneDataNode, VizConfigBuilders } from '@grafana/scenes';
import { VizPanel } from '@grafana/scenes-react';
import { GraphDrawStyle, VisibilityMode } from '@grafana/schema';
import {
  AxisPlacement,
  BarAlignment,
  LegendDisplayMode,
  StackingMode,
  Text,
  TooltipDisplayMode,
  useStyles2,
} from '@grafana/ui';

import { AlertLabels } from '../../components/AlertLabels';
import { overrideToFixedColor } from '../../home/Insights';

import { GenericRow } from './GenericRow';

interface Instance {
  labels: Labels;
  series: DataFrame[];
}

interface InstanceRowProps {
  instance: Instance;
  commonLabels: Labels;
  leftColumnWidth: number;
  timeRange: TimeRange;
  depth?: number;
}

const chartConfig = VizConfigBuilders.timeseries()
  .setCustomFieldConfig('drawStyle', GraphDrawStyle.Bars)
  .setCustomFieldConfig('barWidthFactor', 1)
  .setCustomFieldConfig('barAlignment', BarAlignment.After)
  .setCustomFieldConfig('showPoints', VisibilityMode.Never)
  .setCustomFieldConfig('fillOpacity', 60)
  .setCustomFieldConfig('lineWidth', 0)
  .setCustomFieldConfig('stacking', { mode: StackingMode.None })
  .setCustomFieldConfig('axisPlacement', AxisPlacement.Hidden)
  .setCustomFieldConfig('axisGridShow', false)
  .setOption('tooltip', { mode: TooltipDisplayMode.Multi })
  .setOption('legend', {
    showLegend: false,
    displayMode: LegendDisplayMode.Hidden,
  })
  .setMin(0)
  .setMax(1)
  .setOverrides((builder) =>
    builder
      .matchFieldsWithName('firing')
      .overrideColor(overrideToFixedColor('firing'))
      .matchFieldsWithName('pending')
      .overrideColor(overrideToFixedColor('pending'))
  )
  .build();

export function InstanceRow({ instance, commonLabels, leftColumnWidth, timeRange, depth = 0 }: InstanceRowProps) {
  const styles = useStyles2(getStyles);

  const dataProvider = useMemo(
    () =>
      new SceneDataNode({
        data: {
          series: instance.series,
          state: LoadingState.Done,
          timeRange,
        },
      }),
    [instance, timeRange]
  );

  return (
    <GenericRow
      width={leftColumnWidth}
      title={
        isEmpty(instance.labels) ? (
          <div className={styles.wrapper}>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="alerting.triage.no-labels">No labels</Trans>
            </Text>
          </div>
        ) : (
          <AlertLabels labels={instance.labels} commonLabels={commonLabels} size="xs" wrap="nowrap" />
        )
      }
      content={
        <VizPanel title="" hoverHeader={true} viz={chartConfig} dataProvider={dataProvider} displayMode="transparent" />
      }
      depth={depth}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      minHeight: theme.spacing(2.5),
      display: 'flex',
      alignItems: 'center',
    }),
  };
};
