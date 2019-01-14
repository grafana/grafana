// Libraries
import React, { SFC } from 'react';

interface Props {
  title?: string;
  onClose?: () => void;
  children: JSX.Element | JSX.Element[];
}

export const PanelOptionsGroup: SFC<Props> = props => {
  return (
    <div className="panel-options-group">
      {props.title && (
        <div className="panel-options-group__header">
          {props.title}
          {props.onClose && (
            <button className="btn btn-link" onClick={props.onClose}>
              <i className="fa fa-remove" />
            </button>
          )}
        </div>
      )}
      <div className="panel-options-group__body">{props.children}</div>
    </div>
  );
};
