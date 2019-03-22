// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { SingleStatOptions, SingleStatBaseOptions } from './types';

import { DisplayValue, PanelProps, NullValueMode, calculateStats } from '@grafana/ui';
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

  return data.map(table => {
    // Support last_time?  Add that to the migration?  last, but differnt column
    if (stat === 'name') {
      // Should not really be possible anymore?
      return display(table.name);
    }
    return display(
      calculateStats({
        table,
        columnIndex: 0, // Hardcoded for now!
        stats: [stat], // The stats to calculate
        nullValueMode: NullValueMode.Null,
      })[stat]
    );
  });
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
