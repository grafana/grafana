import React, { SFC } from 'react';

interface Props {
  message: any;
}

export const Alert: SFC<Props> = props => {
  const { message } = props;
  return (
    <div className="gf-form-group section">
      <div className="alert-error alert">
        <div className="alert-icon">
          <i className="fa fa-exclamation-triangle" />
        </div>
        <div className="alert-body">
          <div className="alert-title">{message}</div>
        </div>
      </div>
    </div>
  );
};
