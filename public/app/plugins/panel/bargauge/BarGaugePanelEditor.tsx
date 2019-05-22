// Libraries
import React, { PureComponent } from 'react';

// Components
import {
  ThresholdsEditor,
  ValueMappingsEditor,
  PanelOptionsGrid,
  FieldDisplayEditor,
  FieldDisplayOptions,
  Field,
  FieldPropertiesEditor,
} from '@grafana/ui';

// Types
import { FormLabel, PanelEditorProps, Threshold, Select, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions, orientationOptions, displayModes } from './types';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onThresholdsChanged = (thresholds: Threshold[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      thresholds,
    });

  onValueMappingsChanged = (mappings: ValueMapping[]) =>
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      mappings,
    });

  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onDefaultsChange = (field: Partial<Field>) => {
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      defaults: field,
    });
  };

  onOrientationChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });

  render() {
    const { options } = this.props;
    const { fieldOptions } = options;

    const labelWidth = 6;

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} options={fieldOptions} labelWidth={labelWidth}>
            <div className="form-field">
              <FormLabel width={labelWidth}>Orientation</FormLabel>
              <Select
                width={12}
                options={orientationOptions}
                defaultValue={orientationOptions[0]}
                onChange={this.onOrientationChange}
                value={orientationOptions.find(item => item.value === options.orientation)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={labelWidth}>Mode</FormLabel>
              <Select
                width={12}
                options={displayModes}
                defaultValue={displayModes[0]}
                onChange={this.onDisplayModeChange}
                value={displayModes.find(item => item.value === options.displayMode)}
              />
            </div>
          </FieldDisplayEditor>

          <FieldPropertiesEditor
            title="Field"
            showMinMax={true}
            onChange={this.onDefaultsChange}
            value={fieldOptions.defaults}
          />

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={fieldOptions.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
