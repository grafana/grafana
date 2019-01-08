import React, { Component } from 'react';

interface ErrorInfo {
  componentStack: string;
}

interface RenderProps {
  error: Error;
  errorInfo: ErrorInfo;
}

interface Props {
  children: (r: RenderProps) => JSX.Element;
}

interface State {
  error: Error;
  errorInfo: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    const { error, errorInfo } = this.state;
    return (
      <>
        {this.props.children({
          error,
          errorInfo,
        })}
      </>
    );
  }
}

export default ErrorBoundary;
