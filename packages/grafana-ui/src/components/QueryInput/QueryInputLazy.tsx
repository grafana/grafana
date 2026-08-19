import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type QueryInputProps } from './QueryInput';

const QueryInputComponent = lazy(() =>
  import(/* webpackChunkName: "grafana-ui-query-input" */ './QueryInput').then((module) => ({
    default: module.QueryInput,
  }))
);

export function QueryInput(props: QueryInputProps) {
  return (
    <ErrorBoundaryAlert
      boundaryName="QueryInputLazy"
      title={t('grafana-ui.query-input.error-label', 'Query input failed to load')}
      style="page"
    >
      <Suspense
        fallback={<LoadingPlaceholder text={t('grafana-ui.query-input.loading-placeholder', 'Loading input')} />}
      >
        <QueryInputComponent {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}
