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
  Scale,
} from '@grafana/ui';

// Types
import { FormLabel, PanelEditorProps, Select, ValueMapping } from '@grafana/ui';
import { BarGaugeOptions, orientationOptions, displayModes } from './types';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onScaleChanged = (scale: Scale) => {
    const fieldOptions = this.props.options.fieldOptions;
    const defaults = {
      ...fieldOptions.defaults,
      scale,
    };
    this.onDisplayOptionsChanged({
      ...fieldOptions,
      defaults,
    });
  };

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
            options={fieldOptions.defaults}
          />

          <ThresholdsEditor onChange={this.onScaleChanged} scale={fieldOptions.defaults.scale} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
