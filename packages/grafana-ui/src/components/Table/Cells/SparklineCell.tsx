import * as React from 'react';

import {
  FieldType,
  FieldConfig,
  getMinMaxAndDelta,
  FieldSparkline,
  isDataFrame,
  Field,
  isDataFrameWithValue,
  formattedValueToString,
} from '@grafana/data';
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

import { useTheme2 } from '../../../themes/ThemeContext';
import { measureText } from '../../../utils/measureText';
import { FormattedValueDisplay } from '../../FormattedValueDisplay/FormattedValueDisplay';
import { Sparkline } from '../../Sparkline/Sparkline';
import { TableCellProps } from '../types';
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

export const SparklineCell = (props: TableCellProps) => {
  const { field, innerWidth, tableStyles, cell, cellProps, timeRange } = props;
  const sparkline = getSparkline(cell.value);
  const theme = useTheme2();

  if (!sparkline) {
    return (
      <div {...cellProps} className={tableStyles.cellContainer}>
        {field.config.noValue || 'no data'}
      </div>
    );
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
