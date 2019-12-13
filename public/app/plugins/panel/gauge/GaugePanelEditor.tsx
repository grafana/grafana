// Libraries
import React, { PureComponent } from 'react';
import {
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  Switch,
  PanelOptionsGroup,
  DataLinksEditor,
} from '@grafana/ui';
import { PanelEditorProps, FieldDisplayOptions, Threshold, ValueMapping, FieldConfig, DataLink } from '@grafana/data';

import { GaugeOptions } from './types';
import {
  getCalculationValueDataLinksVariableSuggestions,
  getDataLinksVariableSuggestions,
} from 'app/features/panel/panellinks/link_srv';

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

  onDisplayOptionsChanged = (
    fieldOptions: FieldDisplayOptions,
    event?: React.SyntheticEvent<HTMLElement>,
    callback?: () => void
  ) =>
    this.props.onOptionsChange(
      {
        ...this.props.options,
        fieldOptions,
      },
      callback
    );

  onDefaultsChange = (field: FieldConfig, event?: React.SyntheticEvent<HTMLElement>, callback?: () => void) => {
    this.onDisplayOptionsChanged(
      {
        ...this.props.options.fieldOptions,
        defaults: field,
      },
      event,
      callback
    );
  };

  onDataLinksChanged = (links: DataLink[], callback?: () => void) => {
    this.onDefaultsChange(
      {
        ...this.props.options.fieldOptions.defaults,
        links,
      },
      undefined,
      callback
    );
  };

  render() {
    const { options } = this.props;
    const { fieldOptions, showThresholdLabels, showThresholdMarkers } = options;
    const { defaults } = fieldOptions;

    const suggestions = fieldOptions.values
      ? getDataLinksVariableSuggestions(this.props.data.series)
      : getCalculationValueDataLinksVariableSuggestions(this.props.data.series);

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
            <FieldPropertiesEditor
              showMinMax={true}
              showTitle={true}
              onChange={this.onDefaultsChange}
              value={defaults}
            />
          </PanelOptionsGroup>

          <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />

        <PanelOptionsGroup title="Data links">
          <DataLinksEditor
            value={defaults.links}
            onChange={this.onDataLinksChanged}
            suggestions={suggestions}
            maxLinks={10}
          />
        </PanelOptionsGroup>
      </>
    );
  }
}
