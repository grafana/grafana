import React, { PureComponent, ReactNode } from 'react';
import { uniqueId } from 'lodash';
import { Placement } from '@popperjs/core';
import { Tooltip } from '../../../Tooltip/Tooltip';
import { Icon } from '../../..';
import { LibraryCredential as LibraryCredentialType } from '@grafana/data';

// TODO: move to grafana/ui
const LibraryCredentialVisible = ({
  credentialName,
  libraryCredential,
  defaultValue,
  children,
}: {
  credentialName: string;
  libraryCredential?: LibraryCredentialType;
  defaultValue: any;
  children: (value: any, isDisabled: boolean) => ReactNode;
}) => {
  let value = defaultValue;
  let isDisabled = false;
  if (libraryCredential) {
    const match =
      libraryCredential.jsonData[credentialName] ||
      libraryCredential.secureJsonFields[credentialName] ||
      (libraryCredential.secureJsonData && libraryCredential.secureJsonData[credentialName]) ||
      (libraryCredential as any)[credentialName];

    if (match) {
      isDisabled = true;
      value = match;
    }
  }
  return (
    <>
      <span>{children(value, isDisabled)}</span>
    </>
  );
};
export interface Props {
  label: string;
  checked: boolean;
  className?: string;
  labelClass?: string;
  switchClass?: string;
  tooltip?: string;
  tooltipPlacement?: Placement;
  transparent?: boolean;
  credentialName?: string;
  libraryCredential?: LibraryCredentialType;
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
      credentialName,
      libraryCredential,
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
          <LibraryCredentialVisible
            credentialName={credentialName || ''}
            libraryCredential={libraryCredential}
            defaultValue={checked}
          >
            {(value, isDisabled) => (
              <div className={switchClassName} style={isDisabled ? { border: 'solid', cursor: 'default' } : {}}>
                <input
                  id={labelId}
                  type="checkbox"
                  checked={value}
                  onChange={this.internalOnChange}
                  disabled={isDisabled}
                />
                <span className="gf-form-switch__slider" />
              </div>
            )}
          </LibraryCredentialVisible>
        </label>
      </div>
    );
  }
}
