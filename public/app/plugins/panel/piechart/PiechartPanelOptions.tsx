import React, { PureComponent } from 'react';
import { PanelOptionsProps, PanelOptionsGrid } from '@grafana/ui';

import ValueOptions from './ValueOptions';
import { PiechartOptions } from './types';

export const defaultProps = {
  options: {
    pieType: 'pie',
    unit: 'short',
    stat: 'current',
    strokeWidth: 1,
  },
};

export default class PiechartPanelOptions extends PureComponent<PanelOptionsProps<PiechartOptions>> {
  static defaultProps = defaultProps;

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
