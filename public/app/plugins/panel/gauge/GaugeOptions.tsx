import React, { PureComponent } from 'react';
import { OptionsProps } from './Options';
import { Switch } from 'app/core/components/Switch/Switch';

interface Props {
  onChange: (item: any) => any;
  options: OptionsProps;
}

export default class GaugeOptions extends PureComponent<Props> {
  toggleThresholdLabels = () =>
    this.props.onChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  toggleThresholdMarkers = () =>
    this.props.onChange({ ...this.props.options, showThresholdMarkers: !this.props.options.showThresholdMarkers });

  render() {
    const { showThresholdLabels, showThresholdMarkers } = this.props.options;

    return (
      <div className="section gf-form-group">
        <h5 className="page-heading">Gauge</h5>
        <div className="gf-form-inline">
          <Switch
            label="Threshold labels"
            labelClass="width-10"
            checked={showThresholdLabels}
            onChange={this.toggleThresholdLabels}
          />
        </div>
        <div className="gf-form-inline">
          <Switch
            label="Threshold markers"
            labelClass="width-10"
            checked={showThresholdMarkers}
            onChange={this.toggleThresholdMarkers}
          />
        </div>
      </div>
    );
  }
}
