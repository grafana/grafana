import * as React from 'react';

import { PluginContext } from '@grafana/data';
import { faro } from '@grafana/faro-web-sdk';

interface PluginErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: Error | null; errorInfo: React.ErrorInfo | null }>;
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface PluginErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class PluginErrorBoundary extends React.Component<PluginErrorBoundaryProps, PluginErrorBoundaryState> {
  static contextType = PluginContext;

  declare context: React.ContextType<typeof PluginContext>;

  constructor(props: PluginErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): PluginErrorBoundaryState {
    return { hasError: true, error: error, errorInfo: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Mirror @grafana/ui ErrorBoundary: React render errors never reach
    // window.onerror (the boundary swallows them), so they have to be pushed
    // to Faro explicitly. Plugin id is the boundaryName equivalent.
    faro?.api?.pushError(error, {
      context: {
        type: 'boundary',
        source: this.context?.meta.id ?? 'unknown',
        ...(info.componentStack ? { componentStack: info.componentStack } : {}),
      },
    });

    if (this.props.onError) {
      this.props.onError(error, info);
    } else {
      console.error(`Plugin "${this.context?.meta.id}" failed to load:`, error, info);
    }

    this.setState({ error, errorInfo: info });
  }

  render() {
    const Fallback = this.props.fallback;
    if (this.state.hasError) {
      return Fallback ? <Fallback error={this.state.error} errorInfo={this.state.errorInfo} /> : null;
    }

    return this.props.children;
  }
}
