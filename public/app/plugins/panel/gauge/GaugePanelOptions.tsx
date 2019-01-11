import React, { PureComponent } from 'react';
import { GaugeOptions, GaugePanelOptionsDefaultProps, PanelOptionsProps, ThresholdsEditor } from '@grafana/ui';

import ValueOptions from 'app/plugins/panel/gauge/ValueOptions';
import ValueMappings from 'app/plugins/panel/gauge/ValueMappings';
import GaugeOptionsEditor from './GaugeOptionsEditor';

export default class GaugePanelOptions extends PureComponent<PanelOptionsProps<GaugeOptions>> {
  static defaultProps = GaugePanelOptionsDefaultProps;

  render() {
    const { onChange, options } = this.props;
    return (
      <>
        <div className="form-section">
          <ValueOptions onChange={onChange} options={options} />
          <GaugeOptionsEditor onChange={onChange} options={options} />
          <ThresholdsEditor onChange={onChange} options={options} />
        </div>

        <div className="form-section">
          <ValueMappings onChange={onChange} options={options} />
        </div>
      </>
    );
  }
}
