import React, { PureComponent } from 'react';
import _ from 'lodash';

export interface Props {
  label: string;
  checked: boolean;
  labelClass?: string;
  switchClass?: string;
  onChange: (event) => any;
}

export interface State {
  id: any;
}

export class Switch extends PureComponent<Props, State> {
  state = {
    id: _.uniqueId(),
  };

  internalOnChange = event => {
    event.stopPropagation();
    this.props.onChange(event);
  };

  render() {
    const { labelClass = '', switchClass = '', label, checked } = this.props;

    const labelId = `check-${this.state.id}`;
    const labelClassName = `gf-form-label ${labelClass} pointer`;
    const switchClassName = `gf-form-switch ${switchClass}`;

    return (
      <label htmlFor={labelId} className="gf-form-switch-container">
        {label && <div className={labelClassName}>{label}</div>}
        <div className={switchClassName}>
          <input id={labelId} type="checkbox" checked={checked} onChange={this.internalOnChange} />
          <span className="gf-form-switch__slider" />
        </div>
      </label>
    );
  }
}
