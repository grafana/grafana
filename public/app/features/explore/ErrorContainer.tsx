import React, { FunctionComponent } from 'react';
import { DataQueryError } from '@grafana/data';
import { FadeIn } from 'app/core/components/Animations/FadeIn';
import { getFirstQueryErrorWithoutRefId, getValueWithRefId } from 'app/core/utils/explore';

interface Props {
  queryErrors: DataQueryError[];
}

export const ErrorContainer: FunctionComponent<Props> = props => {
  const { queryErrors } = props;
  const refId = getValueWithRefId(queryErrors);
  const queryError = refId ? null : getFirstQueryErrorWithoutRefId(queryErrors);
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
