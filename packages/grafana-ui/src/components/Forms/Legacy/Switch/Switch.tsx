import { Placement } from '@popperjs/core';
import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';

import { Icon } from '../../..';
import { Tooltip } from '../../../Tooltip/Tooltip';

export interface Props {
  label: string;
  checked: boolean;
  disabled?: boolean;
  className?: string;
  labelClass?: string;
  switchClass?: string;
  tooltip?: string;
  tooltipPlacement?: Placement;
  transparent?: boolean;
  onChange: (event: React.SyntheticEvent<HTMLInputElement>) => void;
}

export interface State {
  id: string;
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
    const {
      labelClass = '',
      switchClass = '',
      label,
      checked,
      disabled,
      transparent,
      className,
      tooltip,
      tooltipPlacement,
    } = this.props;

    const labelId = this.state.id;
    const labelClassName = `gf-form-label ${labelClass} ${transparent ? 'gf-form-label--transparent' : ''} pointer`;
    const switchClassName = `gf-form-switch ${switchClass} ${transparent ? 'gf-form-switch--transparent' : ''}`;

    return (
      <div className="gf-form-switch-container-react">
        <label htmlFor={labelId} className={`gf-form gf-form-switch-container ${className || ''}`}>
          {label && (
            <div className={labelClassName}>
              {label}
              {tooltip && (
                <Tooltip placement={tooltipPlacement ? tooltipPlacement : 'auto'} content={tooltip} theme={'info'}>
                  <Icon name="info-circle" size="sm" style={{ marginLeft: '10px' }} />
                </Tooltip>
              )}
            </div>
          )}
          <div className={switchClassName}>
            <input
              disabled={disabled}
              id={labelId}
              type="checkbox"
              checked={checked}
              onChange={this.internalOnChange}
            />
            <span className="gf-form-switch__slider" />
          </div>
        </label>
      </div>
    );
  }
}
