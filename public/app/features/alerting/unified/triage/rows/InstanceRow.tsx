import { css } from '@emotion/css';
import { isEmpty, omit } from 'lodash';
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
  TooltipDisplayMode,
  useStyles2,
} from '@grafana/ui';

import { AlertLabels } from '../../components/AlertLabels';
import { overrideToFixedColor } from '../../home/Insights';
import { DEFAULT_FIELDS } from '../constants';

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

export function InstanceRow({ instance, commonLabels, leftColumnWidth, timeRange }: InstanceRowProps) {
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

  const labels = omit(instance.labels, DEFAULT_FIELDS);

  return (
    <GenericRow
      width={leftColumnWidth}
      title={
        isEmpty(labels) ? (
          <div className={styles.wrapper}>
            <Trans i18nKey="alerting.triage.no-labels">No labels</Trans>
          </div>
        ) : (
          <AlertLabels labels={labels} commonLabels={commonLabels} />
        )
      }
      content={
        <VizPanel title="" hoverHeader={true} viz={chartConfig} dataProvider={dataProvider} displayMode="transparent" />
      }
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      minHeight: theme.spacing(5),
      display: 'flex',
      alignItems: 'center',
    }),
  };
};
