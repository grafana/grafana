import { css } from '@emotion/css';
import memoize from 'micro-memoize';
import * as React from 'react';

import { type FieldConfig, getMinMaxAndDelta, type Field, isDataFrameWithValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BarAlignment,
  GraphDrawStyle,
  type GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  type TableSparklineCellOptions,
  TableCellDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { measureText } from '../../../../utils/measureText';
import { FormattedValueDisplay } from '../../../FormattedValueDisplay/FormattedValueDisplay';
import { Sparkline } from '../../../Sparkline/Sparkline';
import { MaybeWrapWithLink } from '../components/MaybeWrapWithLink';
import { isTableCellStylesKeyEqual } from '../styles';
import { type SparklineCellProps, type TableCellStyles } from '../types';
import { getAlignmentFactor, getCellOptions, prepareSparklineValue } from '../utils';

const defaultSparklineCellConfig: TableSparklineCellOptions = {
  type: TableCellDisplayMode.Sparkline,
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Smooth,
  lineWidth: 1,
  fillOpacity: 17,
  gradientMode: GraphGradientMode.Hue,
  pointSize: 2,
  barAlignment: BarAlignment.Center,
  showPoints: VisibilityMode.Never,
  hideValue: false,
};

export const SparklineCell = (props: SparklineCellProps) => {
  const { field, value, theme, timeRange, rowIdx, width } = props;
  const preparedSparkline = React.useMemo(() => {
    const valueSparkline = prepareSparklineValue(value, field);
    return valueSparkline ? prepareSparklineForRender(valueSparkline) : undefined;
  }, [field, value]);
  const sparkline = React.useMemo(
    () => (preparedSparkline ? { ...preparedSparkline, timeRange } : undefined),
    [preparedSparkline, timeRange]
  );

  const cellOptions = React.useMemo(() => getTableSparklineCellOptions(field), [field]);

  const config: FieldConfig<GraphFieldConfig> = React.useMemo(
    () => ({
      color: field.config.color,
      custom: {
        ...defaultSparklineCellConfig,
        ...cellOptions,
      },
    }),
    [cellOptions, field.config.color]
  );

  if (!sparkline) {
    return (
      <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
        {field.config.noValue || t('grafana-ui.table.sparkline.no-data', 'no data')}
      </MaybeWrapWithLink>
    );
  }

  const hideValue = cellOptions.hideValue;
  let valueWidth = 0;
  let valueElement: React.ReactNode = null;
  if (!hideValue) {
    const newValue = isDataFrameWithValue(value) ? value.value : null;
    const displayValue = field.display!(newValue);
    const alignmentFactor = getAlignmentFactor(field, displayValue, rowIdx!);

    valueWidth =
      measureText(`${alignmentFactor.prefix ?? ''}${alignmentFactor.text}${alignmentFactor.suffix ?? ''}`, 16).width +
      theme.spacing.gridSize;

    valueElement = <FormattedValueDisplay style={{ width: valueWidth }} value={displayValue} />;
  }

  return (
    <MaybeWrapWithLink field={field} rowIdx={rowIdx}>
      {valueElement}
      <Sparkline width={width - valueWidth} height={25} sparkline={sparkline} config={config} theme={theme} />
    </MaybeWrapWithLink>
  );
};

function getTableSparklineCellOptions(field: Field): TableSparklineCellOptions {
  let options = getCellOptions(field);
  if (options.type === TableCellDisplayMode.Auto) {
    options = { ...options, type: TableCellDisplayMode.Sparkline };
  }
  if (options.type === TableCellDisplayMode.Sparkline) {
    return options;
  }
  throw new Error(`Expected options type ${TableCellDisplayMode.Sparkline} but got ${options.type}`);
}

function prepareSparklineForRender(sparkline: NonNullable<ReturnType<typeof prepareSparklineValue>>) {
  const x = sparkline.x
    ? {
        ...sparkline.x,
        config: { ...sparkline.x.config },
      }
    : undefined;
  const y = {
    ...sparkline.y,
    config: { ...sparkline.y.config },
    values: sparkline.y.values.map((v) => (Number.isFinite(v) ? v : null)),
  };

  // Get the step from the first two values to null-fill the x-axis based on timerange.
  if (x && !x.config.interval && x.values.length > 1) {
    x.config.interval = x.values[1] - x.values[0];
  }

  const range = getMinMaxAndDelta(y);
  y.config.min = range.min;
  y.config.max = range.max;
  y.state = { range };

  return {
    ...sparkline,
    x,
    y,
  };
}

export const getStyles: TableCellStyles = memoize(
  (theme, { textAlign }) =>
    css({
      '&, & > a': {
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1),
        ...(textAlign === 'right' && { flexDirection: 'row-reverse' }),
      },
    }),
  { isMatchingKey: isTableCellStylesKeyEqual }
);
