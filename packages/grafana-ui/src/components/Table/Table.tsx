import { lazy, Suspense } from 'react';

import { t } from '@grafana/i18n';

import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

import { type TableRTProps } from './types';

const LazyTable = lazy(() => import('./TableRT/Table').then((module) => ({ default: module.Table })));

export function Table(props: TableRTProps) {
  return (
    <Suspense
      fallback={
        <div style={{ width: props.width, height: props.height }}>
          <LoadingPlaceholder text={t('grafana-ui.table.loading', 'Loading table')} />
        </div>
      }
    >
      <LazyTable {...props} />
    </Suspense>
  );
}
