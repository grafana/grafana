// Libraries
import React, { FunctionComponent } from 'react';

interface Props {
  title?: string | JSX.Element;
  onClose?: () => void;
  children: JSX.Element | JSX.Element[] | boolean;
  onAdd?: () => void;
}

export const PanelOptionsGroup: FunctionComponent<Props> = props => {
  return (
    <div className="panel-options-group">
      {props.onAdd ? (
        <div className="panel-options-group__header">
          <button className="panel-options-group__add-btn" onClick={props.onAdd}>
            <div className="panel-options-group__add-circle">
              <i className="fa fa-plus" />
            </div>
            <span className="panel-options-group__title">{props.title}</span>
          </button>
        </div>
      ) : (
        props.title && (
          <div className="panel-options-group__header">
            <span className="panel-options-group__title">{props.title}</span>
            {props.onClose && (
              <button className="btn btn-link" onClick={props.onClose}>
                <i className="fa fa-remove" />
              </button>
            )}
          </div>
        )
      )}
      {props.children && <div className="panel-options-group__body">{props.children}</div>}
    </div>
  );
};
