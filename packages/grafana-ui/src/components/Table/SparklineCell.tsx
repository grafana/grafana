import React from 'react';

import {
  FieldType,
  FieldConfig,
  getMinMaxAndDelta,
  FieldSparkline,
  isDataFrame,
  Field,
  DataFrameWithValue,
  DisplayValue,
  DisplayValueAlignmentFactors,
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

import { useTheme2 } from '../../themes';
import { measureText } from '../../utils';
import { FormattedValueDisplay } from '../FormattedValueDisplay/FormattedValueDisplay';
import { Sparkline } from '../Sparkline/Sparkline';

import { TableCellProps } from './types';
import { getCellOptions } from './utils';

export const defaultSparklineCellConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Smooth,
  lineWidth: 1,
  fillOpacity: 17,
  gradientMode: GraphGradientMode.Hue,
  pointSize: 2,
  barAlignment: BarAlignment.Center,
  showPoints: VisibilityMode.Never,
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

  const value = (cell.value as DataFrameWithValue).value;

  const displayValue = field.display!(value);

  const alignmentFactor = getAlignmentFactor(field, displayValue, cell.row.index);

  const valueWidth = measureText(
    `${alignmentFactor.prefix ?? ''}${alignmentFactor.text}${alignmentFactor.suffix ?? ''}`,
    16
  ).width;

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <FormattedValueDisplay
        style={{
          width: `${valueWidth}px`,
          textAlign: 'right',
          marginRight: theme.spacing(1),
        }}
        value={displayValue}
      />
      <div>
        <Sparkline
          width={innerWidth - valueWidth - theme.spacing.gridSize}
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

function getAlignmentFactor(field: Field, displayValue: DisplayValue, rowIndex: number): DisplayValueAlignmentFactors {
  let alignmentFactor = field.state?.alignmentFactors;

  if (alignmentFactor) {
    // check if current alignmentFactor is still the longest
    if (alignmentFactor.text.length < displayValue.text.length) {
      alignmentFactor.text = displayValue.text;
    }
    return alignmentFactor;
  } else {
    // look at the next 1000 rows
    alignmentFactor = { ...displayValue };
    const maxIndex = Math.min(field.values.length, rowIndex + 1000);

    for (let i = rowIndex + 1; i < maxIndex; i++) {
      const nextDisplayValue = field.display!(field.values[i]);
      if (nextDisplayValue.text.length > alignmentFactor.text.length) {
        alignmentFactor.text = displayValue.text;
      }
    }

    if (field.state) {
      field.state.alignmentFactors = alignmentFactor;
    } else {
      field.state = { alignmentFactors: alignmentFactor };
    }

    return alignmentFactor;
  }
}
