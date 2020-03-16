// Libraries
import React, { PureComponent } from 'react';

import {
  ThresholdsEditor,
  PanelOptionsGrid,
  ValueMappingsEditor,
  FieldDisplayEditor,
  FieldPropertiesEditor,
  PanelOptionsGroup,
  DataLinksEditor,
  FormLabel,
  Select,
} from '@grafana/ui';

import {
  ThresholdsConfig,
  ValueMapping,
  FieldConfig,
  DataLink,
  PanelEditorProps,
  FieldDisplayOptions,
} from '@grafana/data';

import { StatPanelOptions, colorModes, graphModes, justifyModes } from './types';
import { orientationOptions } from '../gauge/types';

import {
  getDataLinksVariableSuggestions,
  getCalculationValueDataLinksVariableSuggestions,
} from 'app/features/panel/panellinks/link_srv';

export class StatPanelEditor extends PureComponent<PanelEditorProps<StatPanelOptions>> {
  onThresholdsChanged = (thresholds: ThresholdsConfig) => {
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

  onColorModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, colorMode: value });
  onGraphModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, graphMode: value });
  onJustifyModeChanged = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, justifyMode: value });
  onOrientationChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, orientation: value });

  onDefaultsChange = (field: FieldConfig) => {
    this.onDisplayOptionsChanged({
      ...this.props.options.fieldOptions,
      defaults: field,
    });
  };

  onDataLinksChanged = (links: DataLink[]) => {
    this.onDefaultsChange({
      ...this.props.options.fieldOptions.defaults,
      links,
    });
  };

  render() {
    const { options } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldOptions;
    const suggestions = fieldOptions.values
      ? getDataLinksVariableSuggestions(this.props.data.series)
      : getCalculationValueDataLinksVariableSuggestions(this.props.data.series);

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} labelWidth={8} />
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
              <FormLabel width={8}>Color</FormLabel>
              <Select
                width={12}
                options={colorModes}
                defaultValue={colorModes[0]}
                onChange={this.onColorModeChanged}
                value={colorModes.find(item => item.value === options.colorMode)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Graph</FormLabel>
              <Select
                width={12}
                options={graphModes}
                defaultValue={graphModes[0]}
                onChange={this.onGraphModeChanged}
                value={graphModes.find(item => item.value === options.graphMode)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Justify</FormLabel>
              <Select
                width={12}
                options={justifyModes}
                defaultValue={justifyModes[0]}
                onChange={this.onJustifyModeChanged}
                value={justifyModes.find(item => item.value === options.justifyMode)}
              />
            </div>
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field">
            <FieldPropertiesEditor
              showMinMax={true}
              onChange={this.onDefaultsChange}
              value={defaults}
              showTitle={true}
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
