import * as React from 'react';

import {
  FieldType,
  type FieldConfig,
  getMinMaxAndDelta,
  type FieldSparkline,
  isDataFrame,
  type Field,
  isDataFrameWithValue,
  formattedValueToString,
} from '@grafana/data';
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

import { useTheme2 } from '../../../themes/ThemeContext';
import { measureText } from '../../../utils/measureText';
import { FormattedValueDisplay } from '../../FormattedValueDisplay/FormattedValueDisplay';
import { Sparkline } from '../../Sparkline/Sparkline';
import { getAlignmentFactor, getCellOptions } from '../cellUtils';
import { type TableCellProps } from '../types';

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

export const SparklineCell = (props: TableCellProps) => {
  const { field, innerWidth, tableStyles, cell, cellProps, timeRange } = props;
  const preparedSparkline = React.useMemo(() => {
    const valueSparkline = getSparkline(cell.value);
    return valueSparkline ? prepareSparklineForRender(valueSparkline) : undefined;
  }, [cell.value]);
  const sparkline = React.useMemo(
    () => (preparedSparkline ? { ...preparedSparkline, timeRange } : undefined),
    [preparedSparkline, timeRange]
  );
  const theme = useTheme2();

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
      <div {...cellProps} className={tableStyles.cellContainer}>
        {field.config.noValue || 'no data'}
      </div>
    );
  }

  const hideValue = field.config.custom?.cellOptions?.hideValue;
  let valueWidth = 0;
  let valueElement: React.ReactNode = null;
  if (!hideValue) {
    const value = isDataFrameWithValue(cell.value) ? cell.value.value : null;
    const displayValue = field.display!(value);
    const alignmentFactor = getAlignmentFactor(field, displayValue, cell.row.index);

    valueWidth = measureText(formattedValueToString(alignmentFactor), 16).width + theme.spacing.gridSize;

    valueElement = (
      <FormattedValueDisplay
        style={{
          width: `${valueWidth - theme.spacing.gridSize}px`,
          textAlign: 'right',
          marginRight: theme.spacing(1),
        }}
        value={displayValue}
      />
    );
  }

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      {valueElement}
      <div>
        <Sparkline
          width={innerWidth - valueWidth}
          height={tableStyles.cellHeightInner}
          sparkline={sparkline}
          config={config}
          theme={tableStyles.theme}
        />
      </div>
    </div>
  );
};

function getSparkline(value: unknown): FieldSparkline | undefined {
  if (Array.isArray(value)) {
    return {
      y: {
        name: 'test',
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

function prepareSparklineForRender(sparkline: FieldSparkline): FieldSparkline {
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
