import { Alert, Button } from '@grafana/ui';
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error boundary component specifically for dependency graph components
 */
export class DependencyGraphErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DependencyGraphErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div style={{ padding: '20px' }}>
          <Alert
            title="Dependency Graph Error"
            severity="error"
            children={
              <div>
                <p>An error occurred while rendering the dependency graph.</p>
                {this.state.error && (
                  <details style={{ marginTop: '10px' }}>
                    <summary>Error details</summary>
                    <pre style={{ fontSize: '12px', marginTop: '5px' }}>
                      {this.state.error.toString()}
                      {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
                <Button onClick={this.handleRetry} style={{ marginTop: '10px' }}>
                  Try again
                </Button>
              </div>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}
