import React, { PureComponent } from 'react';
import { PanelEditorProps, PanelOptionsGrid } from '@grafana/ui';

import PieChartValueEditor from './PieChartValueEditor';
import { PieChartOptionsBox } from './PieChartOptionsBox';
import { PieChartOptions, PieChartValueOptions } from './types';

export default class PieChartPanelEditor extends PureComponent<PanelEditorProps<PieChartOptions>> {
  onValueOptionsChanged = (valueOptions: PieChartValueOptions) =>
    this.props.onOptionsChange({
      ...this.props.options,
      valueOptions,
    });

  render() {
    const { onOptionsChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <PieChartValueEditor onChange={this.onValueOptionsChanged} options={options.valueOptions} />
          <PieChartOptionsBox onOptionsChange={onOptionsChange} options={options} />
        </PanelOptionsGrid>
      </>
    );
  }
}
