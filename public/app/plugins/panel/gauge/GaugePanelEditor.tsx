// Libraries
import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayOptions,
  FieldDisplayEditor,
  Field,
  FieldPropertiesEditor,
  Switch,
  Scale,
  PanelOptionsGroup,
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

  render() {
    const { options } = this.props;
    const { fieldOptions, showThresholdLabels, showThresholdMarkers } = options;

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
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={fieldOptions.defaults} />
          </PanelOptionsGroup>

          <ThresholdsEditor onChange={this.onScaleChanged} scale={fieldOptions.defaults.scale} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
