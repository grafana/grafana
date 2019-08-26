import React, { FC } from 'react';

interface Props {
  message: any;
  button?: {
    text: string;
    onClick: (event: React.MouseEvent) => void;
  };
}

export const Alert: FC<Props> = props => {
  const { message, button } = props;
  return (
    <div className="alert-container">
      <div className="alert-error alert">
        <div className="alert-icon">
          <i className="fa fa-exclamation-triangle" />
        </div>
        <div className="alert-body">
          <div className="alert-title">{message}</div>
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
