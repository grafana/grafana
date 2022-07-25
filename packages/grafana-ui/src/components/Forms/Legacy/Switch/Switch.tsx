import { Placement } from '@popperjs/core';
import { uniqueId } from 'lodash';
import React, { PureComponent } from 'react';

import { Icon } from '../../..';
import { Tooltip } from '../../../Tooltip/Tooltip';

export interface Props {
  label: string;
  checked: boolean;
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
                  <div className="gf-form-help-icon gf-form-help-icon--right-normal">
                    <Icon name="info-circle" size="sm" style={{ marginLeft: '10px' }} />
                  </div>
                </Tooltip>
              )}
            </div>
          )}
          <div className={switchClassName}>
            <input id={labelId} type="checkbox" checked={checked} onChange={this.internalOnChange} />
            <span className="gf-form-switch__slider" />
          </div>
        </label>
      </div>
    );
  }
}
