import React, { FunctionComponent } from 'react';

export interface Props {
  onClick: () => void;
}

export const RefreshButton: FunctionComponent<Props> = (props: Props) => {
  return (
    <button className="btn btn--radius-right-0 navbar-button navbar-button--refresh" onClick={props.onClick}>
      <i className="fa fa-refresh" />
    </button>
  );
};
