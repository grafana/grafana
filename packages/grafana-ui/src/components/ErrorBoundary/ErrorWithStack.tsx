import React, { FunctionComponent } from 'react';
import { ErrorBoundaryApi } from './ErrorBoundary';

export interface Props extends ErrorBoundaryApi {
  className: string;
  title: string;
}

export const ErrorWithStack: FunctionComponent<Props> = ({ error, errorInfo, className, title }) => (
  <div className={className}>
    <h2>{title}</h2>
    <details style={{ whiteSpace: 'pre-wrap' }}>
      {error && error.toString()}
      <br />
      {errorInfo && errorInfo.componentStack}
    </details>
  </div>
);

ErrorWithStack.displayName = 'ErrorWithStack';
