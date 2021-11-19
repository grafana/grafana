import React, { FC } from 'react';
import { ArrayVector, Field, FieldType, FieldConfig, getMinMaxAndDelta } from '@grafana/data';
import { TableCellProps } from './types';
import { isArray } from 'lodash';
import { Sparkline } from '../Sparkline/Sparkline';
import { GraphDrawStyle, GraphFieldConfig, LineInterpolation } from '@grafana/schema';

export const BarChartCell: FC<TableCellProps> = (props) => {
  const { field, innerWidth, tableStyles, cell, cellProps } = props;

  //   let config = getFieldConfigWithMinMax(field, false);
  //   if (!config.thresholds) {
  //     config = {
  //       ...config,
  //       thresholds: defaultScale,
  //     };
  //   }

  //   const displayValue = field.display!(cell.value);
  //   let barGaugeMode = BarGaugeDisplayMode.Gradient;

  //   if (field.config.custom && field.config.custom.displayMode === TableCellDisplayMode.LcdGauge) {
  //     barGaugeMode = BarGaugeDisplayMode.Lcd;
  //   } else if (field.config.custom && field.config.custom.displayMode === TableCellDisplayMode.BasicGauge) {
  //     barGaugeMode = BarGaugeDisplayMode.Basic;
  //   }

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
};
