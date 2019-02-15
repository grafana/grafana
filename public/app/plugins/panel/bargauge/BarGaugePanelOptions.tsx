// Libraries
import React, { PureComponent } from 'react';

// Components
import { ValueOptions } from 'app/plugins/panel/gauge/ValueOptions';
import { ThresholdsEditor, ValueMappingsEditor, PanelOptionsGrid, PanelOptionsGroup, FormField } from '@grafana/ui';

// Types
import { PanelOptionsProps, Threshold, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions } from './types';

export class BarGaugePanelOptions extends PureComponent<PanelOptionsProps<BarGaugeOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.props.onChange({
      ...this.props.options,
      thresholds,
    });

  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.props.onChange({
      ...this.props.options,
      valueMappings,
    });

  onMinValueChange = ({ target }) => this.props.onChange({ ...this.props.options, minValue: target.value });
  onMaxValueChange = ({ target }) => this.props.onChange({ ...this.props.options, maxValue: target.value });

  render() {
    const { onChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <ValueOptions onChange={onChange} options={options} />
          <PanelOptionsGroup title="Gauge">
            <FormField label="Min value" labelWidth={8} onChange={this.onMinValueChange} value={options.minValue} />
            <FormField label="Max value" labelWidth={8} onChange={this.onMaxValueChange} value={options.maxValue} />
          </PanelOptionsGroup>
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
