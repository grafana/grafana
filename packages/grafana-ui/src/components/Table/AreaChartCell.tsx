import { isArray, isNumber } from 'lodash';
import React, { FC } from 'react';

import { ArrayVector, Field, FieldType, FieldConfig, NumericRange, reduceField, ReducerID } from '@grafana/data';
import { GraphDrawStyle, GraphFieldConfig, LineInterpolation } from '@grafana/schema';

import { Sparkline } from '../Sparkline/Sparkline';

import { TableCellProps } from './types';

export const AreaChartCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps } = props;

  if (!isArray(cell.value)) {
    return <span>Data is not an array</span>;
  }

  const yField: Field = {
    name: 'test',
    type: FieldType.number,
    values: new ArrayVector(cell.value),
    config: {},
  };

  const range = getMinMaxAndDelta(yField);
  yField.config.min = range.min;
  yField.config.max = range.max;
  yField.state = { range };

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
        sparkline={{ y: yField }}
        config={config}
        theme={tableStyles.theme}
      />
    </div>
  );

  function getMinMaxAndDelta(field: Field): NumericRange {
    if (field.type !== FieldType.number) {
      return { min: 0, max: 100, delta: 100 };
    }

    // Calculate min/max if required
    let min = field.config.min;
    let max = field.config.max;

    if (!isNumber(min) || !isNumber(max)) {
      if (field.values && field.values.length) {
        const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
        if (!isNumber(min)) {
          min = stats[ReducerID.min];
        }
        if (!isNumber(max)) {
          max = stats[ReducerID.max];
        }
      } else {
        min = 0;
        max = 100;
      }
    }

    return {
      min,
      max,
      delta: max! - min!,
    };
  }
};
