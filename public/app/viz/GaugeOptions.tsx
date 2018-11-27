import React, { PureComponent } from 'react';
import { PanelOptionsProps } from '../types';

interface Props {}

export class GaugeOptions extends PureComponent<PanelOptionsProps<Props>> {
  render() {
    return (
      <div>
        <div className="section gf-form-group">
          <h5 className="page-heading">Draw Modes</h5>
        </div>
      </div>
    );
  }
}
