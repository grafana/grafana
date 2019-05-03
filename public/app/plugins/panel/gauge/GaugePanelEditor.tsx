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
  Switch,
} from '@grafana/ui';

import { GaugeOptions } from './types';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  labelWidth = 6;

  onToggleThresholdLabels = () =>
    this.props.onOptionsChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onOptionsChange({
      ...this.props.options,
      showThresholdMarkers: !this.props.options.showThresholdMarkers,
    });

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
    const { options } = this.props;
    const { fieldOptions, showThresholdLabels, showThresholdMarkers } = options;

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor
            onChange={this.onDisplayOptionsChanged}
            options={fieldOptions}
            labelWidth={this.labelWidth}
          >
            <Switch
              label="Labels"
              labelClass={`width-${this.labelWidth}`}
              checked={showThresholdLabels}
              onChange={this.onToggleThresholdLabels}
            />
            <Switch
              label="Markers"
              labelClass={`width-${this.labelWidth}`}
              checked={showThresholdMarkers}
              onChange={this.onToggleThresholdMarkers}
            />
          </FieldDisplayEditor>

          <FieldPropertiesEditor
            title="Field"
            showMinMax={true}
            onChange={this.onDefaultsChange}
            options={fieldOptions.defaults}
          />

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={fieldOptions.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
