import React, { PureComponent, ReactNode } from 'react';
import { Alert } from '@grafana/ui';

interface ErrorInfo {
  componentStack: string;
}

interface RenderProps {
  error: Error;
  errorInfo: ErrorInfo;
}

interface Props {
  children: (r: RenderProps) => ReactNode;
}

interface State {
  error: Error;
  errorInfo: ErrorInfo;
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

interface WithAlertBoxProps {
  title?: string;
  children: ReactNode;
}

export class ErrorBoundaryAlert extends PureComponent<WithAlertBoxProps> {
  static defaultProps: Partial<WithAlertBoxProps> = {
    title: 'An unexpected error happened',
  };

  render() {
    const { title, children } = this.props;
    return (
      <ErrorBoundary>
        {({ error, errorInfo }) => {
          if (!errorInfo) {
            return children;
          }

          return (
            <Alert title={title}>
              <details style={{ whiteSpace: 'pre-wrap' }}>
                {error && error.toString()}
                <br />
                {errorInfo.componentStack}
              </details>
            </Alert>
          );
        }}
      </ErrorBoundary>
    );
  }
}
