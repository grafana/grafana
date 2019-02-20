import React, { PureComponent } from 'react';
import { PanelEditorProps, PanelOptionsGrid } from '@grafana/ui';

import ValueOptions from './ValueOptions';
import { PiechartOptions } from './types';

export default class PiechartPanelEditor extends PureComponent<PanelEditorProps<PiechartOptions>> {
  render() {
    const { onChange, options } = this.props;

    return (
      <>
        <PanelOptionsGrid>
          <ValueOptions onChange={onChange} options={options} />
        </PanelOptionsGrid>
      </>
    );
  }
}
