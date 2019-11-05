import React, { FunctionComponent } from 'react';
import { Button, ErrorInfo } from '@grafana/ui';

interface Props {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  className: string;
}

export const ErrorLoadingChunk: FunctionComponent<Props> = ({ error, errorInfo, className }) => (
  <div className={className}>
    <h2>Unable to find application file</h2>
    <br />
    <h2 className="page-heading">Grafana has likely been updated. Please try reloading the page.</h2>
    <br />
    <div className="gf-form-group">
      <Button size={'md'} variant={'secondary'} icon="fa fa-repeat" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
    <details style={{ whiteSpace: 'pre-wrap' }}>
      {error && error.toString()}
      <br />
      {errorInfo.componentStack}
    </details>
  </div>
);

ErrorLoadingChunk.displayName = 'ErrorLoadingChunk';
