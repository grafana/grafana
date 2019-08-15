// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  FieldDisplayOptions,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  Switch,
  PanelOptionsGroup,
} from '@grafana/ui';
import { Threshold, ValueMapping, FieldConfig } from '@grafana/data';

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

  onThresholdsChanged = (thresholds: Threshold[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      thresholds,
    });
  };

  onValueMappingsChanged = (mappings: ValueMapping[]) => {
    const current = this.props.options.fieldOptions.defaults;
    this.onDefaultsChange({
      ...current,
      mappings,
    });
  };

  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onDefaultsChange = (field: FieldConfig) => {
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      defaults: field,
    });
  };

  render() {
    const { options } = this.props;
    const { fieldOptions, showThresholdLabels, showThresholdMarkers } = options;
    const { defaults } = fieldOptions;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor
              onChange={this.onDisplayOptionsChanged}
              value={fieldOptions}
              labelWidth={this.labelWidth}
            />
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
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field">
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={defaults} />
          </PanelOptionsGroup>

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />
      </>
    );
  }
}
