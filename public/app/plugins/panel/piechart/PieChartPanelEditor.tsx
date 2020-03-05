import React, { PureComponent } from 'react';
import { PanelOptionsGrid, FieldDisplayEditor, PanelOptionsGroup } from '@grafana/ui';
import { PanelEditorProps, FieldDisplayOptions } from '@grafana/data';

import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions } from './types';

export class PieChartPanelEditor extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onDisplayOptionsChanged = (fieldOptions: FieldDisplayOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      fieldOptions,
    });

  render() {
    const { onOptionsChange, options, data } = this.props;
    const { fieldOptions } = options;
    return (
      <>
        <PanelOptionsGrid>
          <PanelOptionsGroup title="Display">
            <FieldDisplayEditor onChange={this.onDisplayOptionsChanged} value={fieldOptions} />
          </PanelOptionsGroup>

          <PieChartOptionsBox data={data} onOptionsChange={onOptionsChange} options={options} />
        </PanelOptionsGrid>
      </>
    );
  }
}
