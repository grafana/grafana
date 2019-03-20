// Libraries
import React, { PureComponent, CSSProperties } from 'react';

// Types
import { SingleStatOptions, SingleStatBaseOptions } from './types';

import { processSingleStatPanelData, DisplayValue, PanelProps } from '@grafana/ui';
import { config } from 'app/core/config';
import { getDisplayProcessor } from '@grafana/ui';
import { ProcessedValuesRepeater } from './ProcessedValuesRepeater';

export const getSingleStatValues = (props: PanelProps<SingleStatBaseOptions>): DisplayValue[] => {
  const { panelData, replaceVariables, options } = props;
  const { valueOptions, valueMappings } = options;
  const processor = getDisplayProcessor({
    unit: valueOptions.unit,
    decimals: valueOptions.decimals,
    mappings: valueMappings,
    thresholds: options.thresholds,

    prefix: replaceVariables(valueOptions.prefix),
    suffix: replaceVariables(valueOptions.suffix),
    theme: config.theme,
  });
  return processSingleStatPanelData({
    panelData: panelData,
    stat: valueOptions.stat,
  }).map(stat => processor(stat.value));
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
    const { height, width, options, panelData, renderCounter } = this.props;
    return (
      <ProcessedValuesRepeater
        getProcessedValues={this.getProcessedValues}
        renderValue={this.renderValue}
        width={width}
        height={height}
        source={panelData}
        renderCounter={renderCounter}
        orientation={options.orientation}
      />
    );
  }
}
