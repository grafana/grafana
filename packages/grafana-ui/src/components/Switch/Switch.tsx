import React, { PureComponent } from 'react';
import uniqueId from 'lodash/uniqueId';
import { Input } from '@grafana/ui';

export interface Props {
  label: string;
  checked: boolean;
  className?: string;
  labelClass?: string;
  switchClass?: string;
  transparent?: boolean;
  onChange: (event?: React.SyntheticEvent<HTMLInputElement>) => void;
}

export interface State {
  id: any;
}

export class Switch extends PureComponent<Props, State> {
  state = {
    id: uniqueId(),
  };

  internalOnChange = (event: React.FormEvent<HTMLInputElement>) => {
    event.stopPropagation();

    this.props.onChange(event);
  };

  render() {
    const { labelClass = '', switchClass = '', label, checked, transparent, className } = this.props;

    const labelId = this.state.id;
    const labelClassName = `gf-form-label ${labelClass} ${transparent ? 'gf-form-label--transparent' : ''} pointer`;
    const switchClassName = `gf-form-switch ${switchClass} ${transparent ? 'gf-form-switch--transparent' : ''}`;

    return (
      <div className="gf-form-switch-container-react">
        <label htmlFor={labelId} className={`gf-form gf-form-switch-container ${className || ''}`}>
          {label && <div className={labelClassName}>{label}</div>}
          <div className={switchClassName}>
            <Input id={labelId} type="checkbox" checked={checked} onChange={this.internalOnChange} />
            <span className="gf-form-switch__slider" />
          </div>
        </label>
      </div>
    );
  }
}
