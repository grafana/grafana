// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { SingleStatOptions, SingleStatBaseOptions } from './types';

import { DisplayValue, PanelProps, processTimeSeries, NullValueMode, guessColumnTypes, ColumnType } from '@grafana/ui';
import { config } from 'app/core/config';
import { getDisplayProcessor } from '@grafana/ui';
import { ProcessedValuesRepeater } from './ProcessedValuesRepeater';

export const getSingleStatValues = (props: PanelProps<SingleStatBaseOptions>): DisplayValue[] => {
  const { data, replaceVariables, options } = props;
  const { valueOptions, valueMappings } = options;
  const { unit, decimals, stat } = valueOptions;

  const processor = getDisplayProcessor({
    unit,
    decimals,
    mappings: valueMappings,
    thresholds: options.thresholds,
    prefix: replaceVariables(valueOptions.prefix),
    suffix: replaceVariables(valueOptions.suffix),
    theme: config.theme,
  });

  const values: DisplayValue[] = [];
  for (let t = 0; t < data.length; t++) {
    const table = guessColumnTypes(data[t]);
    for (let i = 0; i < table.columns.length; i++) {
      const column = table.columns[i];

      // Show all columns that are not 'time'
      if (column.type === ColumnType.number) {
        const series = processTimeSeries({
          data: [table],
          xColumn: i,
          yColumn: i,
          nullValueMode: NullValueMode.Null,
        })[0];

        const value = stat !== 'name' ? series.stats[stat] : series.label;
        values.push(processor(value));
      }
    }
  }

  if (values.length === 0) {
    throw { message: 'Could not find numeric data' };
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
