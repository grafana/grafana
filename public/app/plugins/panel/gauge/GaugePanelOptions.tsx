import React, { PureComponent } from 'react';
import ValueOptions from 'app/plugins/panel/gauge/ValueOptions';
import { BasicGaugeColor } from 'app/types';
import { PanelOptionsProps, ThresholdsEditor } from '@grafana/ui';
import ValueMappings from 'app/plugins/panel/gauge/ValueMappings';
import { Options } from './types';
import GaugeOptions from './GaugeOptions';

export const defaultProps = {
  options: {
    baseColor: BasicGaugeColor.Green,
    minValue: 0,
    maxValue: 100,
    prefix: '',
    showThresholdMarkers: true,
    showThresholdLabels: false,
    suffix: '',
    decimals: 0,
    stat: 'avg',
    unit: 'none',
    mappings: [],
    thresholds: [],
  },
};

export default class GaugePanelOptions extends PureComponent<PanelOptionsProps<Options>> {
  static defaultProps = defaultProps;

  render() {
    const { onChange, options } = this.props;
    return (
      <>
        <div className="form-section">
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptions onChange={onChange} options={options} />
          <ThresholdsEditor onChange={onChange} options={options} />
        </div>

        <div className="form-section">
          <ValueMappings onChange={onChange} options={options} />
        </div>
      </>
    );
  }
}
