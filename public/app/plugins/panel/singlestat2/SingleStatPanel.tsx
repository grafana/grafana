// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { SingleStatOptions, SingleStatBaseOptions } from './types';

import { DisplayValue, PanelProps, NullValueMode, FieldType, calculateStats } from '@grafana/ui';
import { config } from 'app/core/config';
import { getDisplayProcessor } from '@grafana/ui';
import { ProcessedValuesRepeater } from './ProcessedValuesRepeater';

export const getSingleStatValues = (props: PanelProps<SingleStatBaseOptions>): DisplayValue[] => {
  const { data, replaceVariables, options } = props;
  const { valueOptions, valueMappings } = options;
  const { unit, decimals, stat } = valueOptions;

  const display = getDisplayProcessor({
    unit,
    decimals,
    mappings: valueMappings,
    thresholds: options.thresholds,
    prefix: replaceVariables(valueOptions.prefix),
    suffix: replaceVariables(valueOptions.suffix),
    theme: config.theme,
  });

  const values: DisplayValue[] = [];

  for (const series of data) {
    if (stat === 'name') {
      values.push(display(series.name));
    }

    for (let i = 0; i < series.fields.length; i++) {
      const column = series.fields[i];

      // Show all columns that are not 'time'
      if (column.type === FieldType.number) {
        const stats = calculateStats({
          series,
          fieldIndex: i,
          stats: [stat], // The stats to calculate
          nullValueMode: NullValueMode.Null,
        });
        const displayValue = display(stats[stat]);
        values.push(displayValue);
      }
    }
  }

  if (values.length === 0) {
    values.push({
      numeric: 0,
      text: 'No data',
    });
  }

  return values;
};

export class SingleStatPanel extends PureComponent<PanelProps<SingleStatOptions>> {
  renderValue = (value: DisplayValue, width: number, height: number): JSX.Element => {
    const style: CSSProperties = {};
    style.margin = '0 auto';
    style.fontSize = '250%';
    style.textAlign = 'center';
    if (value.color) {
      style.color = value.color;
    }

    return (
      <div style={{ width, height }}>
        <div style={style}>{value.text}</div>
      </div>
    );
  };

  getProcessedValues = (): DisplayValue[] => {
    return getSingleStatValues(this.props);
  };

  render() {
    const { height, width, options, data, renderCounter } = this.props;
    return (
      <ProcessedValuesRepeater
        getProcessedValues={this.getProcessedValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
