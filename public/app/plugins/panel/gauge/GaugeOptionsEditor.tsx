import React, { PureComponent } from 'react';
import { GaugeOptions, PanelOptionsProps, PanelOptionsGroup } from '@grafana/ui';

import { Switch } from 'app/core/components/Switch/Switch';
import { FormGroup } from '@grafana/ui/src';

export default class GaugeOptionsEditor extends PureComponent<PanelOptionsProps<GaugeOptions>> {
  onToggleThresholdLabels = () =>
    this.props.onChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onChange({ ...this.props.options, showThresholdMarkers: !this.props.options.showThresholdMarkers });

  onMinValueChange = ({ target }) => this.props.onChange({ ...this.props.options, minValue: target.value });

  onMaxValueChange = ({ target }) => this.props.onChange({ ...this.props.options, maxValue: target.value });

  render() {
    const { options } = this.props;
    const { maxValue, minValue, showThresholdLabels, showThresholdMarkers } = options;

    return (
      <PanelOptionsGroup title="Gauge">
        <FormGroup
          label="Min value"
          labelWidth={8}
          inputProps={{ onChange: event => this.onMinValueChange(event), value: minValue }}
        />
        <FormGroup
          label="Max value"
          labelWidth={8}
          inputProps={{ onChange: event => this.onMaxValueChange(event), value: maxValue }}
        />
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
      </PanelOptionsGroup>
    );
  }
}
