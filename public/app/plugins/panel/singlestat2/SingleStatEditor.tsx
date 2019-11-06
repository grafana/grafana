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

import { Threshold, ValueMapping, FieldConfig, DataLink, PanelEditorProps, FieldDisplayOptions } from '@grafana/data';

import { SingleStatOptions, SparklineOptions, displayModes, colorModes } from './types';
import { SparklineEditor } from './SparklineEditor';
import {
  getDataLinksVariableSuggestions,
  getCalculationValueDataLinksVariableSuggestions,
} from 'app/features/panel/panellinks/link_srv';

export class SingleStatEditor extends PureComponent<PanelEditorProps<SingleStatOptions>> {
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

  onSparklineChanged = (sparkline: SparklineOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      sparkline,
    });

  onDisplayModeChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });
  onColorModeChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, colorMode: value });

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
              <FormLabel width={8}>Display mode</FormLabel>
              <Select
                width={12}
                options={displayModes}
                defaultValue={displayModes[0]}
                onChange={this.onDisplayModeChange}
                value={displayModes.find(item => item.value === options.displayMode)}
              />
            </div>
            <div className="form-field">
              <FormLabel width={8}>Color by</FormLabel>
              <Select
                width={12}
                options={colorModes}
                defaultValue={colorModes[0]}
                onChange={this.onColorModeChange}
                value={colorModes.find(item => item.value === options.colorMode)}
              />
            </div>
            <SparklineEditor options={options.sparkline} onChange={this.onSparklineChanged} />
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field (default)">
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={defaults} />
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
