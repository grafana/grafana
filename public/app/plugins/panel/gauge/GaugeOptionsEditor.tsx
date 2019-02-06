import React, { PureComponent } from 'react';
import {
  FormField,
  FormLabel,
  PanelOptionsProps,
  PanelOptionsGroup,
  Select,
  SelectOptionItem,
  Switch,
} from '@grafana/ui';

import { GaugeOptions } from './types';

export default class GaugeOptionsEditor extends PureComponent<PanelOptionsProps<GaugeOptions>> {
  directionOptions: SelectOptionItem[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'horizontal', label: 'Horizontal' },
    { value: 'vertical', label: 'Vertical' },
  ];

  labelWidth = 9;

  onToggleThresholdLabels = () =>
    this.props.onChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onChange({ ...this.props.options, showThresholdMarkers: !this.props.options.showThresholdMarkers });

  onMinValueChange = ({ target }) => this.props.onChange({ ...this.props.options, minValue: target.value });

  onMaxValueChange = ({ target }) => this.props.onChange({ ...this.props.options, maxValue: target.value });

  onDirectionChange = ({ value }) => this.props.onChange({ ...this.props.options, direction: value });

  render() {
    const { options } = this.props;
    const { direction, maxValue, minValue, showThresholdLabels, showThresholdMarkers } = options;

    return (
      <PanelOptionsGroup title="Gauge">
        <FormField label="Min value" labelWidth={this.labelWidth} onChange={this.onMinValueChange} value={minValue} />
        <FormField label="Max value" labelWidth={this.labelWidth} onChange={this.onMaxValueChange} value={maxValue} />
        <Switch
          label="Show labels"
          labelClass={`width-${this.labelWidth}`}
          checked={showThresholdLabels}
          onChange={this.onToggleThresholdLabels}
        />
        <Switch
          label="Show markers"
          labelClass={`width-${this.labelWidth}`}
          checked={showThresholdMarkers}
          onChange={this.onToggleThresholdMarkers}
        />
        <div className="gf-form">
          <FormLabel width={this.labelWidth}>Direction</FormLabel>
          <Select
            defaultValue={this.directionOptions[0]}
            onChange={this.onDirectionChange}
            options={this.directionOptions}
            value={this.directionOptions.find(option => option.value === direction)}
            width={12}
          />
        </div>
      </PanelOptionsGroup>
    );
  }
}
