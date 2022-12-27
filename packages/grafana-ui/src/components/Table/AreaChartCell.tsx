import { isArray } from 'lodash';
import React, { FC } from 'react';

import { ArrayVector, FieldType, FieldConfig, getMinMaxAndDelta, FieldSparkline, isDataFrame } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { TableCellProps } from './types';

export const AreaChartCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps } = props;

  const sparkline = getSparkline(cell.value);

  if (!sparkline) {
    return (
      <div {...cellProps} className={tableStyles.cellContainer}>
        Invalid value
      </div>
    );
  }

  const range = getMinMaxAndDelta(sparkline.y);
  sparkline.y.config.min = range.min;
  sparkline.y.config.max = range.max;
  sparkline.y.state = { range };

  const config: FieldConfig<GraphFieldConfig> = {
    color: field.config.color,
    custom: {
      drawStyle: GraphDrawStyle.Line,
      lineInterpolation: LineInterpolation.Linear,
      lineWidth: 1,
      fillOpacity: 20,
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
