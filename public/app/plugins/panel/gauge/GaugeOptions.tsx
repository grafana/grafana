import React, { PureComponent } from 'react';
import { Switch } from 'app/core/components/Switch/Switch';
import { OptionModuleProps } from './module';
import { Label } from '../../../core/components/Label/Label';

export default class GaugeOptions extends PureComponent<OptionModuleProps> {
  onToggleThresholdLabels = () =>
    this.props.onChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onChange({ ...this.props.options, showThresholdMarkers: !this.props.options.showThresholdMarkers });

  onMinValueChange = ({ target }) => this.props.onChange({ ...this.props.options, minValue: target.value });

  onMaxValueChange = ({ target }) => this.props.onChange({ ...this.props.options, maxValue: target.value });

  render() {
    const { maxValue, minValue, showThresholdLabels, showThresholdMarkers } = this.props.options;

    return (
      <div className="section gf-form-group">
        <h5 className="section-heading">Gauge</h5>
        <div className="gf-form">
          <Label width={8}>Min value</Label>
          <input type="text" className="gf-form-input width-12" onChange={this.onMinValueChange} value={minValue} />
        </div>
        <div className="gf-form">
          <Label width={8}>Max value</Label>
          <input type="text" className="gf-form-input width-12" onChange={this.onMaxValueChange} value={maxValue} />
        </div>
        <Switch
          label="Show labels"
          labelClass="width-8"
          checked={showThresholdLabels}
          onChange={this.onToggleThresholdLabels}
        />
        <Switch
          label="Show markers"
          labelClass="width-8"
          checked={showThresholdMarkers}
          onChange={this.onToggleThresholdMarkers}
        />
      </div>
    );
  }
}
