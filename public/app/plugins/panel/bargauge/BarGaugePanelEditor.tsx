// Libraries
import React, { PureComponent } from 'react';

import {
  PanelOptionsGrid,
  FieldDisplayEditor,
  PanelOptionsGroup,
  FormLabel,
  Select,
  Switch,
  FieldPropertiesEditor,
  ThresholdsEditor,
  LegacyValueMappingsEditor,
  DataLinksEditor,
} from '@grafana/ui';
import {
  DataLink,
  FieldConfig,
  FieldDisplayOptions,
  PanelEditorProps,
  ThresholdsConfig,
  ValueMapping,
} from '@grafana/data';
import { BarGaugeOptions, displayModes } from './types';
import { orientationOptions } from '../gauge/types';
import {
  getCalculationValueDataLinksVariableSuggestions,
  getDataLinksVariableSuggestions,
} from '../../../features/panel/panellinks/link_srv';
import { NewPanelEditorContext } from '../../../features/dashboard/components/PanelEditor/PanelEditor';

export class BarGaugePanelEditor extends PureComponent<PanelEditorProps<BarGaugeOptions>> {
  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  onOrientationChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, orientation: value });
  onDisplayModeChange = ({ value }: any) => this.props.onOptionsChange({ ...this.props.options, displayMode: value });
  onToggleShowUnfilled = () => {
    this.props.onOptionsChange({ ...this.props.options, showUnfilled: !this.props.options.showUnfilled });
  };

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

  onDefaultsChange = (field: FieldConfig, event?: React.SyntheticEvent<HTMLElement>, callback?: () => void) => {
    this.props.onFieldConfigChange({
      ...this.props.fieldConfig,
      defaults: field,
    });
  };

  render() {
    const { options, fieldConfig } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldConfig;

    const labelWidth = 6;
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
                  <FieldDisplayEditor
                    onChange={this.onDisplayOptionsChanged}
                    value={fieldOptions}
                    labelWidth={labelWidth}
                  />
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
                  <>
                    {options.displayMode !== 'lcd' && (
                      <Switch
                        label="Unfilled"
                        labelClass={`width-${labelWidth}`}
                        checked={options.showUnfilled}
                        onChange={this.onToggleShowUnfilled}
                      />
                    )}
                  </>
                </PanelOptionsGroup>
                <>
                  {!useNewEditor && (
                    <>
                      <PanelOptionsGroup title="Field">
                        <FieldPropertiesEditor
                          showMinMax={true}
                          showTitle={true}
                          onChange={this.onDefaultsChange}
                          value={defaults}
                        />
                      </PanelOptionsGroup>

                      <ThresholdsEditor onChange={this.onThresholdsChanged} thresholds={defaults.thresholds} />
                    </>
                  )}
                </>
              </PanelOptionsGrid>

              {!useNewEditor && (
                <LegacyValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />
              )}

              {!useNewEditor && (
                <PanelOptionsGroup title="Data links">
                  <DataLinksEditor
                    value={defaults.links}
                    onChange={this.onDataLinksChanged}
                    suggestions={suggestions}
                    maxLinks={10}
                  />
                </PanelOptionsGroup>
              )}
            </>
          );
        }}
      </NewPanelEditorContext.Consumer>
    );
  }
}
