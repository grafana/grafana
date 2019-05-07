import React, { FunctionComponent } from 'react';
import { DataQueryError } from '@grafana/ui';
import { FadeIn } from 'app/core/components/Animations/FadeIn';

export const hasRefId = (value: any) => {
  if (!value) {
    return false;
  }

  if (value.refId) {
    return true;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const keys = Object.keys(value);
  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];
    if (hasRefId(value[key])) {
      return true;
    }
  }

  return false;
};

interface Props {
  queryError: DataQueryError;
}

export const ErrorContainer: FunctionComponent<Props> = props => {
  const { queryError } = props;
  const showError = queryError && !hasRefId(queryError);
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
