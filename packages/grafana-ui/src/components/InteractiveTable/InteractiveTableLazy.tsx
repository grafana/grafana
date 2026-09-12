import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type InteractiveTable as InteractiveTableImpl } from './InteractiveTable';

// React.lazy erases the relationship between the generic row type and the column/callback props.
const LazyInteractiveTable = lazy(() =>
  import('./InteractiveTable').then((module) => ({ default: module.InteractiveTable }))
) as typeof InteractiveTableImpl;

export function InteractiveTable<TableData extends object>(
  props: Parameters<typeof InteractiveTableImpl<TableData>>[0]
) {
  return (
    <Suspense fallback={<LoadingPlaceholder text={t('grafana-ui.interactive-table.loading', 'Loading table')} />}>
      <LazyInteractiveTable {...props} />
    </Suspense>
  );
}
