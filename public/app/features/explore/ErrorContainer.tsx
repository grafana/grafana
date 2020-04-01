import React, { FunctionComponent } from 'react';
import { DataQueryError } from '@grafana/data';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

export interface ErrorContainerProps {
  queryError?: DataQueryError;
}

export const ErrorContainer: FunctionComponent<ErrorContainerProps> = props => {
  const { queryError } = props;
  const showError = queryError ? true : false;
  const duration = showError ? 100 : 10;
  const message = queryError ? queryError.message : null;

  return (
    <FadeIn in={showError} duration={duration}>
      <div className="alert-container">
        <div className="alert-error alert">
          <div className="alert-icon">
            <i className="fa fa-exclamation-triangle" />
          </div>
          <div className="alert-body">
            <div className="alert-title">{message}</div>
          </div>
        </div>
      </div>
    </FadeIn>
  );
};
