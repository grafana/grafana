// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { SingleStatOptions, SingleStatBaseOptions } from './types';

import { DisplayValue, PanelProps, processTimeSeries, NullValueMode } from '@grafana/ui';
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

  return processTimeSeries({
    data,
    nullValueMode: NullValueMode.Null,
  }).map((series, index) => {
    const value = stat !== 'name' ? series.stats[stat] : series.label;
    return processor(value);
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
    const { height, width, options, data } = this.props;
    const { orientation } = options;
    return (
      <ProcessedValuesRepeater
        getProcessedValues={this.getProcessedValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={data}
        orientation={orientation}
      />
    );
  }
}
