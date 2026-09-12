import { type ComponentProps, lazy, Suspense } from 'react';
import { type default as ReactCalendar } from 'react-calendar';

import { t } from '@grafana/i18n';

import { LoadingPlaceholder } from '../LoadingPlaceholder/LoadingPlaceholder';

const LazyCalendar = lazy(() => import('react-calendar'));

export function Calendar(props: ComponentProps<typeof ReactCalendar>) {
  return (
    <Suspense
      fallback={
        <div style={{ width: 268, minHeight: 256 }}>
          <LoadingPlaceholder text={t('grafana-ui.calendar.loading', 'Loading calendar')} />
        </div>
      }
    >
      <LazyCalendar {...props} />
    </Suspense>
  );
}
