import React, { PureComponent } from 'react';
import {
  BasicGaugeColor,
  GaugeOptions,
  PanelOptionsProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
} from '@grafana/ui';

import ValueOptions from 'app/plugins/panel/gauge/ValueOptions';
import ValueMappings from 'app/plugins/panel/gauge/ValueMappings';
import GaugeOptionsEditor from './GaugeOptionsEditor';

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

export default class GaugePanelOptions extends PureComponent<PanelOptionsProps<GaugeOptions>> {
  static defaultProps = defaultProps;

  onThresholdsChanged = (thresholds: Threshold[]) => this.props.onChange({ ...this.props.options, thresholds });

  render() {
    const { onChange, options } = this.props;
    return (
      <>
        <PanelOptionsGrid>
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptionsEditor onChange={onChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappings onChange={onChange} options={options} />
      </>
    );
  }
}
