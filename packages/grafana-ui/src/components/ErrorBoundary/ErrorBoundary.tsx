import React, { PureComponent, ReactNode } from 'react';
import { Alert } from '../Alert/Alert';
import { css } from 'emotion';

interface ErrorInfo {
  componentStack: string;
}

interface RenderProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface Props {
  children: (r: RenderProps) => ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends PureComponent<Props, State> {
  readonly state: State = {
    error: null,
    errorInfo: null,
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo,
    });
  }

  render() {
    const { children } = this.props;
    const { error, errorInfo } = this.state;

    return children({
      error,
      errorInfo,
    });
  }
}

function getAlertPageStyle() {
  return css`
    width: 500px;
    margin: 64px auto;
  `;
}

interface WithAlertBoxProps {
  title?: string;
  children: ReactNode;
  style?: 'page' | 'alertbox';
}

export class ErrorBoundaryAlert extends PureComponent<WithAlertBoxProps> {
  static defaultProps: Partial<WithAlertBoxProps> = {
    title: 'An unexpected error happened',
    style: 'alertbox',
  };

  render() {
    const { title, children, style } = this.props;

    return (
      <ErrorBoundary>
        {({ error, errorInfo }) => {
          if (!errorInfo) {
            return children;
          }

          if (style === 'alertbox') {
            return (
              <Alert title={title || ''}>
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  {error && error.toString()}
                  <br />
                  {errorInfo.componentStack}
                </details>
              </Alert>
            );
          } else {
            return (
              <div className={getAlertPageStyle()}>
                <h2>{title}</h2>
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  {error && error.toString()}
                  <br />
                  {errorInfo.componentStack}
                </details>
              </div>
            );
          }
        }}
      </ErrorBoundary>
    );
  }
}
