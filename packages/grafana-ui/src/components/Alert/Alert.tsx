import React, { FC, ReactNode } from 'react';

interface Props {
  title: string;
  button?: {
    text: string;
    onClick: (event: React.MouseEvent) => void;
  };
  children?: ReactNode;
}

export const Alert: FC<Props> = props => {
  const { title, button, children } = props;
  return (
    <div className="alert-container">
      <div className="alert-error alert">
        <div className="alert-icon">
          <i className="fa fa-exclamation-triangle" />
        </div>
        <div className="alert-body">
          <div className="alert-title">{title}</div>
          {children && <div className="alert-text">{children}</div>}
        </div>
        {button && (
          <div className="alert-button">
            <button className="btn btn-outline-danger" onClick={button.onClick}>
              {button.text}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
