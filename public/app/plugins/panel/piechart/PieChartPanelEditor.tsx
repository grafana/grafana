import React, { PureComponent } from 'react';
import {
  PanelEditorProps,
  PanelOptionsGrid,
  ValueMappingsEditor,
  ValueMapping,
  SingleStatValueOptions,
  SingleStatValueEditor,
} from '@grafana/ui';

import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions } from './types';

export class PieChartPanelEditor extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onValueMappingsChanged = (valueMappings: ValueMapping[]) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueMappings,
    });

  onValueOptionsChanged = (valueOptions: SingleStatValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueOptions,
    });

  render() {
    const { onOptionsChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <SingleStatValueEditor onChange={this.onValueOptionsChanged} options={options.valueOptions} />
          <PieChartOptionsBox onOptionsChange={onOptionsChange} options={options} />
        </PanelOptionsGrid>

        <ValueMappingsEditor onChange={this.onValueMappingsChanged} valueMappings={options.valueMappings} />
      </>
    );
  }
}
