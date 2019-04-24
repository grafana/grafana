// Libraries
import React, { PureComponent } from 'react';

// Components
import {
  ThresholdsEditor,
  ValueMappingsEditor,
  PanelOptionsGrid,
  PanelOptionsGroup,
  FormField,
  SingleStatValueOptions,
  SingleStatValueEditor,
} from '@grafana/ui';

// Types
import { FormLabel, PanelEditorProps, Threshold, Select, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions, orientationOptions, displayModes } from './types';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.props.onOptionsChange({
      ...this.props.options,
      thresholds,
    });

  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueMappings,
    });

  onValueOptionsChanged = (valueOptions: SingleStatValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueOptions,
    });

  onMinValueChange = ({ target }) => this.props.onOptionsChange({ ...this.props.options, minValue: target.value });
  onMaxValueChange = ({ target }) => this.props.onOptionsChange({ ...this.props.options, maxValue: target.value });
  onOrientationChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });

  render() {
    const { options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <SingleStatValueEditor onChange={this.onValueOptionsChanged} value={options.valueOptions} />
          <PanelOptionsGroup title="Gauge">
            <FormField label="Min value" labelWidth={8} onChange={this.onMinValueChange} value={options.minValue} />
            <FormField label="Max value" labelWidth={8} onChange={this.onMaxValueChange} value={options.maxValue} />
            <div className="form-field">
              <FormLabel width={8}>Orientation</FormLabel>
              <Select
                width={12}
                options={orientationOptions}
                defaultValue={orientationOptions[0]}
                onChange={this.onOrientationChange}
                value={orientationOptions.find(item => item.value === options.orientation)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Display Mode</FormLabel>
              <Select
                width={12}
                options={displayModes}
                defaultValue={displayModes[0]}
                onChange={this.onDisplayModeChange}
                value={displayModes.find(item => item.value === options.displayMode)}
              />
            </div>
          </PanelOptionsGroup>
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={options.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
