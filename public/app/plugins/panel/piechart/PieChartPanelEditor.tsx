import React, { PureComponent } from 'react';
import { PanelEditorProps, PanelOptionsGrid, ValueMappingsEditor, ValueMapping } from '@grafana/ui';

import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions } from './types';
import { SingleStatValueEditor } from '../singlestat2/SingleStatValueEditor';
import { SingleStatValueOptions } from '../singlestat2/types';

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
