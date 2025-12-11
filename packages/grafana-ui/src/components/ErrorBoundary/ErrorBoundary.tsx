import { PureComponent, ReactNode, ComponentType, ErrorInfo, memo } from 'react';

import { faro } from '@grafana/faro-web-sdk';
import { t } from '@grafana/i18n';

import { Alert } from '../Alert/Alert';

import { ErrorWithStack } from './ErrorWithStack';

export type { ErrorInfo };

export interface ErrorBoundaryApi {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

interface Props {
  /** Name of the error boundary. Used when reporting errors in Faro. */
  boundaryName?: string;

  children: (r: ErrorBoundaryApi) => ReactNode;
  /** Will re-render children after error if recover values changes */
  dependencies?: unknown[];
  /** Callback called on error */
  onError?: (error: Error) => void;
  /** Callback error state is cleared due to recover props change */
  onRecover?: () => void;
  /** Default error logger - Faro by default */
  errorLogger?: (error: Error) => void;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * A React component that catches errors in child components. Useful for logging or displaying a fallback UI in case of errors. More information about error boundaries is available at [React documentation website](https://reactjs.org/docs/error-boundaries.html).
 *
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/utilities-errorboundary--docs
 */
export class ErrorBoundary extends PureComponent<Props, State> {
  readonly state: State = {
    error: null,
    errorInfo: null,
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (this.props.errorLogger) {
      this.props.errorLogger(error);
    } else {
      faro?.api?.pushError(error, {
        context: {
          type: 'boundary',
          source: this.props.boundaryName ?? 'unknown',
        },
      });
    }

    this.setState({ error, errorInfo });

    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { dependencies, onRecover } = this.props;

    if (this.state.error) {
      if (dependencies && prevProps.dependencies) {
        for (let i = 0; i < dependencies.length; i++) {
          if (dependencies[i] !== prevProps.dependencies[i]) {
            this.setState({ error: null, errorInfo: null });
            if (onRecover) {
              onRecover();
            }
            break;
          }
        }
      }
    }
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

/**
 * Props for the ErrorBoundaryAlert component
 *
 * @public
 */
export interface ErrorBoundaryAlertProps {
  /** Name of the error boundary. Used when reporting errors in Faro. */
  boundaryName?: string;

  /** Title for the error boundary alert */
  title?: string;

  /** Component to be wrapped with an error boundary */
  children: ReactNode;

  /** 'page' will render full page error with stacktrace. 'alertbox' will render an <Alert />. Default 'alertbox' */
  style?: 'page' | 'alertbox';

  /** Will re-render children after error if recover values changes */
  dependencies?: unknown[];
  /** Default error logger - Faro by default */
  errorLogger?: (error: Error) => void;
}

export const ErrorBoundaryAlert = memo(
  ({ title, children, style = 'alertbox', dependencies, errorLogger, boundaryName }: ErrorBoundaryAlertProps) => {
    const alertTitle = title ?? t('grafana-ui.error-boundary.title', 'An unexpected error happened');
    return (
      <ErrorBoundary dependencies={dependencies} errorLogger={errorLogger} boundaryName={boundaryName}>
        {({ error, errorInfo }) => {
          if (!errorInfo) {
            return children;
          }

          if (style === 'alertbox') {
            return (
              <Alert title={alertTitle}>
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  {error && error.toString()}
                  <br />
                  {errorInfo.componentStack}
                </details>
              </Alert>
            );
          }

          return <ErrorWithStack title={alertTitle} error={error} errorInfo={errorInfo} />;
        }}
      </ErrorBoundary>
    );
  }
);

ErrorBoundaryAlert.displayName = 'ErrorBoundaryAlert';

/**
 * HOC for wrapping a component in an error boundary.
 *
 * @param Component - the react component to wrap in error boundary
 * @param errorBoundaryProps - error boundary options
 *
 * @public
 */
export function withErrorBoundary<P extends {} = {}>(
  Component: ComponentType<P>,
  errorBoundaryProps: Omit<ErrorBoundaryAlertProps, 'children'> = {}
): ComponentType<P> {
  const comp = (props: P) => (
    <ErrorBoundaryAlert {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundaryAlert>
  );
  comp.displayName = 'WithErrorBoundary';

  return comp;
}
