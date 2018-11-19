import React, { PureComponent } from 'react';
import _ from 'lodash';

export interface Props {
  label: string;
  checked: boolean;
  labelClass?: string;
  small?: boolean;
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
    const { labelClass = '', switchClass = '', label, checked, small } = this.props;

    const labelId = `check-${this.state.id}`;
    let labelClassName = `gf-form-label ${labelClass} pointer`;
    let switchClassName = `gf-form-switch ${switchClass}`;
    if (small) {
      labelClassName += ' gf-form-label--small';
      switchClassName += ' gf-form-switch--small';
    }

    return (
      <label htmlFor={labelId} className="gf-form-switch-container">
        {label && <label className={labelClassName}>{label}</label>}
        <div className={switchClassName}>
          <input id={labelId} type="checkbox" checked={checked} onChange={this.internalOnChange} />
          <span className="gf-form-switch__slider" />
        </div>
      </label>
    );
  }
}
