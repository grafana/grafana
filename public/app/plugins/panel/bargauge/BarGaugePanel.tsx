// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { DisplayValue, PanelProps, BarGauge, getSingleStatDisplayValues } from '@grafana/ui';
import { config } from 'app/core/config';

// Types
import { BarGaugeOptions } from './types';
import { ProcessedValuesRepeater } from '../singlestat2/ProcessedValuesRepeater';

export class BarGaugePanel extends PureComponent<PanelProps<BarGaugeOptions>> {
  renderValue = (value: DisplayValue, width: number, height: number): JSX.Element => {
    const { options } = this.props;

    return (
      <BarGauge
        value={value}
        width={width}
        height={height}
        orientation={options.orientation}
        thresholds={options.thresholds}
        theme={config.theme}
        displayMode={options.displayMode}
      />
    );
  };

  getProcessedValues = (): DisplayValue[] => {
    return getSingleStatDisplayValues({
      valueMappings: this.props.options.valueMappings,
      thresholds: this.props.options.thresholds,
      valueOptions: this.props.options.valueOptions,
      data: this.props.data,
      theme: config.theme,
      replaceVariables: this.props.replaceVariables,
    });
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
