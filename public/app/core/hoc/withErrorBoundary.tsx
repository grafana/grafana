import { ErrorBoundaryAlert, ErrorBoundaryProps } from '@grafana/ui';
import React, { ComponentType } from 'react';

export function withErrorBoundary<P = {}>(
  style: ErrorBoundaryProps['style'],
  Component: ComponentType<P>
): ComponentType<P> {
  const comp = (props: P) => (
    <ErrorBoundaryAlert style={style}>
      <Component {...props} />
    </ErrorBoundaryAlert>
  );
  comp.displayName = 'WithErrorBoundary';

  return comp;
}
