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
  FieldColorModeId,
  GraphDrawStyle,
  GraphFieldConfig,
  GraphGradientMode,
  LineInterpolation,
  TableAreaChartCellOptions,
  TableCellDisplayMode,
  VisibilityMode,
} from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { TableCellProps } from './types';
import { getCellOptions } from './utils';

export const defaultAreaChartCellConfig: GraphFieldConfig = {
  drawStyle: GraphDrawStyle.Line,
  lineInterpolation: LineInterpolation.Smooth,
  lineWidth: 1,
  fillOpacity: 17,
  gradientMode: GraphGradientMode.Hue,
  pointSize: 1,
  barAlignment: BarAlignment.Center,
  showPoints: VisibilityMode.Never,
};

export const AreaChartCell: FC<TableCellProps> = (props) => {
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

  const cellOptions = getTableAreaChartCellOptions(field);

  const config: FieldConfig<GraphFieldConfig> = {
    color: cellOptions.color ? { mode: FieldColorModeId.Fixed, fixedColor: cellOptions.color } : field.config.color,
    custom: {
      ...defaultAreaChartCellConfig,
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

function getTableAreaChartCellOptions(field: Field): TableAreaChartCellOptions {
  const options = getCellOptions(field);
  if (options.type === TableCellDisplayMode.AreaChart) {
    return options;
  }
  throw new Error(`Excpected options type ${TableCellDisplayMode.AreaChart} but got ${options.type}`);
}
