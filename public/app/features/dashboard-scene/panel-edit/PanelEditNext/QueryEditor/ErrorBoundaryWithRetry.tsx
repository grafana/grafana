import { Component, type ErrorInfo, type PropsWithChildren } from 'react';

import { Trans } from '@grafana/i18n';
import { Alert, Button } from '@grafana/ui';

interface State {
  hasError: boolean;
}

export class ErrorBoundaryWithRetry extends Component<PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Transformation editor failed to load:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert
          severity="warning"
          title=""
        >
          <Trans i18nKey="transformers.error-boundary.failed-to-load">
            Failed to load the transformation editor.
          </Trans>{' '}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
          >
            <Trans i18nKey="transformers.error-boundary.retry">Retry</Trans>
          </Button>
        </Alert>
      );
    }

    return this.props.children;
  }
}
