import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  FieldDisplayEditor,
  FieldDisplayOptions,
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

  render() {
    const { onOptionsChange, options } = this.props;
    const { fieldOptions } = options;

    return (
      <>
        <PanelOptionsGrid>
          <FieldDisplayEditor
            onChange={this.onDisplayOptionsChanged}
            options={fieldOptions}
            showMinMax={true}
            showPrefixSuffix={false}
          />
          <PieChartOptionsBox onOptionsChange={onOptionsChange} options={options} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={fieldOptions.mappings} />
      </>
    );
  }
}
