import * as React from 'react';

import { Trans } from '@grafana/i18n';

type Props = {
  fallBackComponent?: React.ReactNode;
};

export class ErrorBoundary extends React.Component<React.PropsWithChildren<Props>, { hasError: boolean }> {
  constructor(props: React.PropsWithChildren<Props>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      const FallBack = this.props.fallBackComponent || (
        <div>
          <Trans i18nKey="grafana-sql.components.error-boundary.fall-back.error">Error</Trans>
        </div>
      );
      return FallBack;
    }

    return this.props.children;
  }
}
