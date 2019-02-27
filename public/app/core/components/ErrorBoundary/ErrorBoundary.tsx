import { Component } from 'react';

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

export default ErrorBoundary;
