import React, { PureComponent } from 'react';
import _ from 'lodash';

export interface Props {
  label: string;
  checked?: boolean;
  labelClass?: string;
  switchClass?: string;
  onChange: () => any;
}

export interface State {
  id: any;
}

export class FormSwitch extends PureComponent<Props, State> {
  state = {
    id: _.uniqueId(),
  };

  internalOnChange = () => {
    this.props.onChange();
  };

  render() {
    const { labelClass, switchClass, label, checked } = this.props;
    const labelId = `check-${this.state.id}`;
    const labelClassName = `gf-form-label ${labelClass} pointer`;
    const switchClassName = `gf-form-switch ${switchClass}`;

    return (
      <div className="gf-form-switch-react">
        {label && (
          <label htmlFor={labelId} className={labelClassName}>
            {label}
          </label>
        )}
        <div className={switchClassName}>
          <input id={labelId} type="checkbox" checked={checked} onChange={this.internalOnChange} />
          <label htmlFor={labelId} data-on="Yes" data-off="No" />
        </div>
      </div>
    );
  }
}

export default FormSwitch;
