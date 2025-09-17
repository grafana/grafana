import { css } from '@emotion/css';
import * as React from 'react';

import {
  FieldType,
  FieldConfig,
  getMinMaxAndDelta,
  FieldSparkline,
  isDataFrame,
  Field,
  isDataFrameWithValue,
} from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  BarAlignment,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  TableSparklineCellOptions,
  TableCellDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { measureText } from '../../../../utils/measureText';
import { FormattedValueDisplay } from '../../../FormattedValueDisplay/FormattedValueDisplay';
import { Sparkline } from '../../../Sparkline/Sparkline';
import { SparklineCellProps, TableCellStyles } from '../types';
import { getAlignmentFactor, getCellOptions } from '../utils';

export const defaultSparklineCellConfig: TableSparklineCellOptions = {
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
  const sparkline = getSparkline(value, field);

  if (!sparkline) {
    return <>{field.config.noValue || t('grafana-ui.table.sparkline.no-data', 'no data')}</>;
  }

  // Get the step from the first two values to null-fill the x-axis based on timerange
  if (sparkline.x && !sparkline.x.config.interval && sparkline.x.values.length > 1) {
    sparkline.x.config.interval = sparkline.x.values[1] - sparkline.x.values[0];
  }

  // Remove non-finite values, e.g: NaN, +/-Infinity
  sparkline.y.values = sparkline.y.values.map((v) => {
    if (!Number.isFinite(v)) {
      return null;
    } else {
      return v;
    }
  });

  const range = getMinMaxAndDelta(sparkline.y);
  sparkline.y.config.min = range.min;
  sparkline.y.config.max = range.max;
  sparkline.y.state = { range };
  sparkline.timeRange = timeRange;

  const cellOptions = getTableSparklineCellOptions(field);

  const config: FieldConfig<GraphFieldConfig> = {
    color: field.config.color,
    custom: {
      ...defaultSparklineCellConfig,
      ...cellOptions,
    },
  };

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
    <>
      {valueElement}
      <Sparkline width={width - valueWidth} height={25} sparkline={sparkline} config={config} theme={theme} />
    </>
  );
};

function getSparkline(value: unknown, field: Field): FieldSparkline | undefined {
  if (Array.isArray(value)) {
    return {
      y: {
        name: `${field.name}-sparkline`,
        type: FieldType.number,
        values: value,
        config: {},
      },
    };
  }

  if (isDataFrame(value)) {
    const timeField = value.fields.find((x) => x.type === FieldType.time);
    const numberField = value.fields.find((x) => x.type === FieldType.number);

    if (timeField && numberField) {
      return { x: timeField, y: numberField };
    }
  }

  return;
}

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

export const getStyles: TableCellStyles = (theme, { textAlign }) =>
  css({
    width: '100%',
    gap: theme.spacing(1),
    justifyContent: 'space-between',
    ...(textAlign === 'right' && { flexDirection: 'row-reverse' }),
  });
