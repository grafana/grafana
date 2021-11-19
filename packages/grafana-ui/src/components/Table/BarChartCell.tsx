import React, { FC } from 'react';
import { ArrayVector, Field, FieldType, FieldConfig, getMinMaxAndDelta } from '@grafana/data';
import { TableCellProps } from './types';
import { isArray } from 'lodash';
import { Sparkline } from '../Sparkline/Sparkline';
import { GraphDrawStyle, GraphFieldConfig, GraphGradientMode } from '@grafana/schema';

export const BarChartCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps } = props;

  const values = cell.value;
  if (!isArray(values)) {
    return <span>Data is not an array</span>;
  }

  const yField: Field = {
    name: 'test',
    type: FieldType.number,
    values: new ArrayVector(values),
    config: {},
  };

  const range = getMinMaxAndDelta(yField);
  yField.config.min = range.min;
  yField.config.max = range.max;
  yField.state = { range };

  const config: FieldConfig<GraphFieldConfig> = {
    ...field.config,
    custom: {
      drawStyle: GraphDrawStyle.Bars,
      gradientMode: GraphGradientMode.Scheme,
      lineWidth: 1,
      fillOpacity: 80,
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
};
