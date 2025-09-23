import { ComponentType } from 'react';

import { ErrorBoundaryAlertProps, withErrorBoundary } from '@grafana/ui';

import { logError } from './Analytics';

/**
 * HOC for wrapping alerting page in an error boundary.
 * It provides alerting-specific error handling.
 *
 * @param Component - the react component to wrap in error boundary
 * @param errorBoundaryProps - error boundary options
 *
 * @public
 */
export function withPageErrorBoundary<P extends {} = {}>(
  Component: ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryAlertProps, 'children' | 'errorLogger' | 'style'> = {}
): ComponentType<P> {
  return withErrorBoundary(Component, {
    ...errorBoundaryProps,
    style: 'page',
    errorLogger: logError,
  });
}
