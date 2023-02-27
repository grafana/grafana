import { isArray } from 'lodash';
import React, { FC } from 'react';

import {
  ArrayVector,
  FieldType,
  FieldConfig,
  getMinMaxAndDelta,
  FieldSparkline,
  isDataFrame,
  Field,
} from '@grafana/data';
import {
  BarAlignment,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  TableChartCellOptions,
  TableCellDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { TableCellProps } from './types';
import { getCellOptions } from './utils';

export const defaultChartCellConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Smooth,
  lineWidth: 1,
  fillOpacity: 17,
  gradientMode: GraphGradientMode.Hue,
  pointSize: 2,
  barAlignment: BarAlignment.Center,
  showPoints: VisibilityMode.Never,
};

export const ChartCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps } = props;

  const sparkline = getSparkline(cell.value);

  if (!sparkline) {
    return (
      <div {...cellProps} className={tableStyles.cellContainer}>
        no data
      </div>
    );
  }

  const range = getMinMaxAndDelta(sparkline.y);
  sparkline.y.config.min = range.min;
  sparkline.y.config.max = range.max;
  sparkline.y.state = { range };

  const cellOptions = getTableChartCellOptions(field);

  const config: FieldConfig<GraphFieldConfig> = {
    color: field.config.color,
    custom: {
      ...defaultChartCellConfig,
      ...cellOptions,
    },
  };

  return (
    <div {...cellProps} className={tableStyles.cellContainer}>
      <Sparkline
        width={innerWidth}
        height={tableStyles.cellHeightInner}
        sparkline={sparkline}
        config={config}
        theme={tableStyles.theme}
      />
    </div>
  );
};

function getSparkline(value: unknown): FieldSparkline | undefined {
  if (isArray(value)) {
    return {
      y: {
        name: 'test',
        type: FieldType.number,
        values: new ArrayVector(value),
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

function getTableChartCellOptions(field: Field): TableChartCellOptions {
  let options = getCellOptions(field);
  if (options.type === TableCellDisplayMode.Auto) {
    options = { ...options, type: TableCellDisplayMode.Chart };
  }
  if (options.type === TableCellDisplayMode.Chart) {
    return options;
  }
  throw new Error(`Excpected options type ${TableCellDisplayMode.Chart} but got ${options.type}`);
}
