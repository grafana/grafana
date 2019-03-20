// Libraries
import React, { PureComponent } from 'react';

// Services & Utils
import { DisplayValue, PanelProps, BarGauge } from '@grafana/ui';
import { config } from 'app/core/config';

// Types
import { BarGaugeOptions } from './types';
import { getSingleStatValues } from '../singlestat2/SingleStatPanel';
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
