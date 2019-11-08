import React, { FunctionComponent } from 'react';
import { ErrorBoundaryApi } from './ErrorBoundary';
import { stylesFactory } from '../../themes';
import { css } from 'emotion';

const getStyles = stylesFactory(() => {
  return css`
    width: 500px;
    margin: 64px auto;
  `;
});

export interface Props extends ErrorBoundaryApi {
  title: string;
}

export const ErrorWithStack: FunctionComponent<Props> = ({ error, errorInfo, title }) => (
  <div className={getStyles()}>
    <h2>{title}</h2>
    <details style={{ whiteSpace: 'pre-wrap' }}>
      {error && error.toString()}
      <br />
      {errorInfo && errorInfo.componentStack}
    </details>
  </div>
);

ErrorWithStack.displayName = 'ErrorWithStack';
