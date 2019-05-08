import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayEditor,
  FieldDisplayOptions,
  FieldPropertiesEditor,
  Field,
  PanelOptionsGroup,
} from '@grafana/ui';

import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions } from './types';

export class PieChartPanelEditor extends PureComponent<PanelEditorProps<PieChartOptions>> {
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
    const { onOptionsChange, options } = this.props;
    const { fieldOptions } = options;

    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} />
          </PanelOptionsGroup>

          <FieldPropertiesEditor
            title="Field (default)"
            showMinMax={true}
            onChange={this.onDefaultsChange}
            value={fieldOptions.defaults}
          />

          <PieChartOptionsBox onOptionsChange={onOptionsChange} options={options} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
