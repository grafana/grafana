// Libraries
import React, { PureComponent } from 'react';

// Components
import {
  ThresholdsEditor,
  ValueMappingsEditor,
  PanelOptionsGrid,
  PanelOptionsGroup,
  FieldDisplayEditor,
  FieldDisplayOptions,
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

  onValueOptionsChanged = (valueOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueOptions,
    });

  onOrientationChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });

  render() {
    const { options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor
            onChange={this.onValueOptionsChanged}
            options={options.valueOptions}
            showMinMax={true}
            showPrefixSuffix={false}
          />
          <PanelOptionsGroup title="Gauge">
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
