// Libraries
import React, { PureComponent } from 'react';

import {
  PanelOptionsGrid,
  FieldDisplayEditor,
  PanelOptionsGroup,
  FormLabel,
  Select,
  FieldPropertiesEditor,
  ThresholdsEditor,
  LegacyValueMappingsEditor,
  DataLinksEditor,
} from '@grafana/ui';

import {
  PanelEditorProps,
  FieldDisplayOptions,
  FieldConfig,
  ValueMapping,
  ThresholdsConfig,
  DataLink,
} from '@grafana/data';

import { StatPanelOptions, colorModes, graphModes, justifyModes } from './types';
import { orientationOptions } from '../gauge/types';
import {
  getCalculationValueDataLinksVariableSuggestions,
  getDataLinksVariableSuggestions,
} from '../../../features/panel/panellinks/link_srv';
import { NewPanelEditorContext } from '../../../features/dashboard/components/PanelEditor/PanelEditor';

export class StatPanelEditor extends PureComponent<PanelEditorProps<StatPanelOptions>> {
  onThresholdsChanged = (thresholds: ThresholdsConfig) => {
    const current = this.props.fieldConfig;
    this.props.onFieldConfigChange({
      ...current,
      defaults: {
        ...current.defaults,
        thresholds,
      },
    });
  };

  onValueMappingsChanged = (mappings: ValueMapping[]) => {
    const current = this.props.fieldConfig;
    this.props.onFieldConfigChange({
      ...current,
      defaults: {
        ...current.defaults,
        mappings,
      },
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
    this.props.onFieldConfigChange({
      ...this.props.fieldConfig,
      defaults: field,
    });
  };

  onDataLinksChanged = (links: DataLink[]) => {
    const current = this.props.fieldConfig;
    this.props.onFieldConfigChange({
      ...current,
      defaults: {
        ...current.defaults,
        links,
      },
    });
  };

  render() {
    const { options, fieldConfig } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldConfig;

    const suggestions = fieldOptions.values
      ? getDataLinksVariableSuggestions(this.props.data.series)
      : getCalculationValueDataLinksVariableSuggestions(this.props.data.series);

    return (
      <NewPanelEditorContext.Consumer>
        {useNewEditor => {
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
                <>
                  {!useNewEditor && (
                    <>
                      <PanelOptionsGroup title="Field">
                        <FieldPropertiesEditor
                          showMinMax={true}
                          onChange={this.onDefaultsChange}
                          value={defaults}
                          showTitle={true}
                        />
                      </PanelOptionsGroup>
                      <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
                    </>
                  )}
                </>
              </PanelOptionsGrid>
              {!useNewEditor && (
                <>
                  <LegacyValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />

                  <PanelOptionsGroup title="Data links">
                    <DataLinksEditor
                      value={defaults.links}
                      onChange={this.onDataLinksChanged}
                      suggestions={suggestions}
                      maxLinks={10}
                    />
                  </PanelOptionsGroup>
                </>
              )}
            </>
          );
        }}
      </NewPanelEditorContext.Consumer>
    );
  }
}
