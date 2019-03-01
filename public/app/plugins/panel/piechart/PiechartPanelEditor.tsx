import React, { PureComponent } from 'react';
import { PanelEditorProps, PanelOptionsGrid } from '@grafana/ui';

import PiechartValueEditor from './PiechartValueEditor';
import { PiechartOptionsBox } from './PiechartOptionsBox';
import { PiechartOptions, PiechartValueOptions } from './types';

export default class PiechartPanelEditor extends PureComponent<PanelEditorProps<PiechartOptions>> {
  onValueOptionsChanged = (valueOptions: PiechartValueOptions) =>
    this.props.onChange({
      ...this.props.options,
      valueOptions,
    });

  render() {
    const { onChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <PiechartValueEditor onChange={this.onValueOptionsChanged} options={options.valueOptions} />
          <PiechartOptionsBox onChange={onChange} options={options} />
        </PanelOptionsGrid>
      </>
    );
  }
}
