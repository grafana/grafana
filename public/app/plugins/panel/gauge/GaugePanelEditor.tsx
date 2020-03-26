// Libraries
import React, { PureComponent } from 'react';
import {
  PanelOptionsGrid,
  FieldDisplayEditor,
  Switch,
  PanelOptionsGroup,
  FieldPropertiesEditor,
  ThresholdsEditor,
  LegacyValueMappingsEditor,
  DataLinksEditor,
} from '@grafana/ui';
import {
  PanelEditorProps,
  FieldDisplayOptions,
  ThresholdsConfig,
  DataLink,
  FieldConfig,
  ValueMapping,
} from '@grafana/data';

import { GaugeOptions } from './types';
import {
  getCalculationValueDataLinksVariableSuggestions,
  getDataLinksVariableSuggestions,
} from '../../../features/panel/panellinks/link_srv';
import { NewPanelEditorContext } from '../../../features/dashboard/components/PanelEditor/PanelEditor';

export class GaugePanelEditor extends PureComponent<PanelEditorProps<GaugeOptions>> {
  labelWidth = 6;

  onToggleThresholdLabels = () =>
    this.props.onOptionsChange({ ...this.props.options, showThresholdLabels: !this.props.options.showThresholdLabels });

  onToggleThresholdMarkers = () =>
    this.props.onOptionsChange({
      ...this.props.options,
      showThresholdMarkers: !this.props.options.showThresholdMarkers,
    });

  onDisplayOptionsChanged = (
    fieldOptions: FieldDisplayOptions,
    event?: React.SyntheticEvent<HTMLElement>,
    callback?: () => void
  ) => {
    this.props.onOptionsChange(
      {
        ...this.props.options,
        fieldOptions,
      },
      callback
    );
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

  onDefaultsChange = (field: FieldConfig) => {
    this.props.onFieldConfigChange({
      ...this.props.fieldConfig,
      defaults: field,
    });
  };

  render() {
    const { options, fieldConfig } = this.props;
    const { showThresholdLabels, showThresholdMarkers, fieldOptions } = options;

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
