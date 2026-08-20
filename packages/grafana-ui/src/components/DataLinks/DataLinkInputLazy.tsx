import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { ErrorBoundaryAlert } from '../ErrorBoundary/ErrorBoundary';
import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type DataLinkInputProps } from './DataLinkInput';

const DataLinkInputComponent = lazy(() =>
  import(/* webpackChunkName: "grafana-ui-data-link-input" */ './DataLinkInput').then((module) => ({
    default: module.DataLinkInput,
  }))
);

export function DataLinkInput(props: DataLinkInputProps) {
  return (
    <ErrorBoundaryAlert
      boundaryName="DataLinkInputLazy"
      title={t('grafana-ui.data-link-input.error-label', 'Data link input failed to load')}
      style="page"
    >
      <Suspense
        fallback={<LoadingPlaceholder text={t('grafana-ui.data-link-input.loading-placeholder', 'Loading input')} />}
      >
        <DataLinkInputComponent {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}
