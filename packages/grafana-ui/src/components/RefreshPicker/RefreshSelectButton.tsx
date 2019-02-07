import React, { FunctionComponent } from 'react';

export interface Props {
  value: string | undefined;
  onClick: () => void;
}

export const RefreshSelectButton: FunctionComponent<Props> = (props: Props) => {
  return (
    <button className={'btn navbar-button'} onClick={props.onClick}>
      <div className={'refresh-select-button'}>
        <span className={'refresh-select-button-value'}>{props.value ? props.value : 'Paused'}</span>
        <i className="fa fa-caret-down fa-fw" />
      </div>
    </button>
  );
};
