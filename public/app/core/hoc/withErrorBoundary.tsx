import { ErrorBoundaryAlert } from '@grafana/ui';
import React, { ComponentType } from 'react';
import { WithAlertBoxProps } from '@grafana/ui/src/components/ErrorBoundary/ErrorBoundary';

export function withErrorBoundary<P = {}>(
  style: WithAlertBoxProps['style'],
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
