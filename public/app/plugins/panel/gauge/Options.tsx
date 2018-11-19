import React, { PureComponent } from 'react';
import ValueOptions from './ValueOptions';
import { PanelOptionsProps } from 'app/types';
import GaugeOptions from './GaugeOptions';

export interface OptionsProps {
  decimals: number;
  prefix: string;
  showThresholdLabels: boolean;
  showThresholdMarkers: boolean;
  stat: string;
  suffix: string;
  unit: string;
  thresholds: number[];
  minValue: number;
  maxValue: number;
}

export default class Options extends PureComponent<PanelOptionsProps<OptionsProps>> {
  render() {
    return (
      <div>
        <ValueOptions onChange={this.props.onChange} options={this.props.options} />
        <GaugeOptions onChange={this.props.onChange} options={this.props.options} />
      </div>
    );
  }
}
