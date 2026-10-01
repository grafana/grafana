import { css } from '@emotion/css';
import { Suspense, lazy } from 'react';
import Skeleton from 'react-loading-skeleton';

import type { GrafanaTheme2 } from '@grafana/data';
import { type DataSourcePickerProps } from '@grafana/runtime';
import { LegacyDataSourcePicker, useFlagGrafanaUnifiedDataSourcePicker } from '@grafana/runtime/internal';
import { getInputStyles, useStyles2 } from '@grafana/ui';

const SuspendingDataSourcePicker = lazy(() =>
  import('./DataSourcePicker').then((module) => ({ default: module.DataSourcePicker }))
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

  // The core picker manages its own focus and open state, so these props are not supported
  const { onBlur, autoFocus, openMenuOnFocus, ...rest } = props;

  return (
    <Suspense fallback={<DataSourcePickerSkeleton />}>
      <SuspendingDataSourcePicker {...rest} />
    </Suspense>
  );
}

// This component is used as a fallback for codesplitting, so aim to keep
// the bundle size of it as small as possible :)
function DataSourcePickerSkeleton() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrapper}>
        <button type="button" className={styles.fakeInput} aria-disabled>
          <Skeleton width={100} />
        </button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const baseStyles = getInputStyles({ theme });

  return {
    wrapper: baseStyles.wrapper,
    inputWrapper: baseStyles.inputWrapper,
    fakeInput: css([
      baseStyles.input,
      {
        textAlign: 'left',
      },
    ]),
  };
};
