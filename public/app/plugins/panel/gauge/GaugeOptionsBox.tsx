// Libraries
import React, { PureComponent } from 'react';

// Components
import { Switch, PanelOptionsGroup } from '@grafana/ui';

// Types
import { FormField, PanelEditorProps } from '@grafana/ui';
import { GaugeOptions } from './types';

export class GaugeOptionsBox extends PureComponent<PanelEditorProps<GaugeOptions>> {
  onToggleThresholdLabels = () =>
    this.props.updateOptions({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.updateOptions({ ...this.props.options, showThresholdMarkers: !this.props.options.showThresholdMarkers });

  onMinValueChange = ({ target }) => this.props.updateOptions({ ...this.props.options, minValue: target.value });

  onMaxValueChange = ({ target }) => this.props.updateOptions({ ...this.props.options, maxValue: target.value });

  render() {
    const { options } = this.props;
    const { maxValue, minValue, showThresholdLabels, showThresholdMarkers } = options;

    return (
      <PanelOptionsGroup title="Gauge">
        <FormField label="Min value" labelWidth={8} onChange={this.onMinValueChange} value={minValue} />
        <FormField label="Max value" labelWidth={8} onChange={this.onMaxValueChange} value={maxValue} />
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
