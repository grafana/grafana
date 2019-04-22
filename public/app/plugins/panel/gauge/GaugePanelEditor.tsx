// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  Threshold,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayOptions,
  FieldDisplayEditor,
  Field,
  FieldPropertiesEditor,
} from '@grafana/ui';

import { GaugeOptionsBox } from './GaugeOptionsBox';
import { GaugeOptions } from './types';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
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

  render() {
    const { onOptionsChange, options } = this.props;
    const { fieldOptions } = options;

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} options={fieldOptions} showPrefixSuffix={false} />

          <FieldPropertiesEditor
            title="Field (default)"
            showMinMax={true}
            onChange={this.onDefaultsChange}
            options={fieldOptions.defaults}
          />

          <GaugeOptionsBox onOptionsChange={onOptionsChange} options={options} />
          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={fieldOptions.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
