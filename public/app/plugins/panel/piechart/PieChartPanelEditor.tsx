import React, { PureComponent } from 'react';
import {
  PanelOptionsGrid,
  FieldDisplayEditor,
  PanelOptionsGroup,
  FieldPropertiesEditor,
  LegacyValueMappingsEditor,
} from '@grafana/ui';
import { PanelEditorProps, FieldDisplayOptions, ValueMapping, FieldConfig } from '@grafana/data';

import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions } from './types';

export class PieChartPanelEditor extends PureComponent<PanelEditorProps<PieChartOptions>> {
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

  onDefaultsChange = (field: FieldConfig) => {
    this.props.onFieldConfigChange({
      ...this.props.fieldConfig,
      defaults: field,
    });
  };

  render() {
    const { onOptionsChange, options, data, fieldConfig, onFieldConfigChange } = this.props;
    const { fieldOptions } = options;
    const { defaults } = fieldConfig;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} />
          </PanelOptionsGroup>

          <PanelOptionsGroup title="Field (default)">
            <FieldPropertiesEditor showMinMax={true} onChange={this.onDefaultsChange} value={defaults} />
          </PanelOptionsGroup>

          <PieChartOptionsBox
            data={data}
            onOptionsChange={onOptionsChange}
            options={options}
            fieldConfig={fieldConfig}
            onFieldConfigChange={onFieldConfigChange}
          />
        </PanelOptionsGrid>
        <LegacyValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={defaults.mappings} />
      </>
    );
  }
}
