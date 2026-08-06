import { Suspense, lazy } from 'react';

import { LegacyDataSourcePicker, type DataSourcePickerProps } from '@grafana/runtime';
import { useFlagGrafanaUnifiedDataSourcePicker } from '@grafana/runtime/internal';

const SuspendingDataSourcePicker = lazy(() =>
  import('./DataSourcePickerAdapter').then((module) => ({ default: module.DataSourcePickerAdapter }))
);

/**
 * Rendered by the DataSourcePicker that @grafana/runtime exposes to plugins.
 * Lazily loads the core picker to keep it out of the initial bundle.
 */
export function RuntimeDataSourcePickerShim(props: DataSourcePickerProps) {
  const unifiedPickerEnabled = useFlagGrafanaUnifiedDataSourcePicker();

  if (!unifiedPickerEnabled) {
    return <LegacyDataSourcePicker {...props} />;
  }

  return (
    <Suspense fallback={<LegacyDataSourcePicker {...props} />}>
      <SuspendingDataSourcePicker {...props} />
    </Suspense>
  );
}
