// Libraries
import React, { SFC } from 'react';

interface Props {
  title?: string;
  onClose?: () => void;
  children: JSX.Element | JSX.Element[];
}

export const PanelOptionSection: SFC<Props> = props => {
  return (
    <div className="panel-option-section">
      {props.title && (
        <div className="panel-option-section__header">
          {props.title}
          {props.onClose && (
            <button className="btn btn-link" onClick={props.onClose}>
              <i className="fa fa-remove" />
            </button>
          )}
        </div>
      )}
      <div className="panel-option-section__body">{props.children}</div>
    </div>
  );
};
