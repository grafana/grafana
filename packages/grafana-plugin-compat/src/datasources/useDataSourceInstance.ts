import { useEffect, useState } from 'react';

import { type DataSourceApi } from '@grafana/data';
import { useDataSourceInstance as stableUseDataSourceInstance } from '@grafana/runtime';
import { useDataSourceInstance as unstableUseDataSourceInstance } from '@grafana/runtime/unstable';

import { getDataSourceInstance } from './getDataSourceInstance';
import { type Ref } from './types';

/** Declared here because `@grafana/runtime` lacks it on older supported hosts. */
export interface UseDataSourceInstanceResult {
  isLoading: boolean;
  error?: Error;
  dataSource?: DataSourceApi;
}

/**
 * Uses the host hook when available. The fallback re-resolves only when `ref` changes, not on data source cache
 * changes. Picked once at load so the hook order stays stable.
 */
export const useDataSourceInstance: (ref?: Ref) => UseDataSourceInstanceResult =
  typeof stableUseDataSourceInstance === 'function'
    ? stableUseDataSourceInstance
    : typeof unstableUseDataSourceInstance === 'function'
      ? unstableUseDataSourceInstance
      : useBackwardsCompatibleDataSourceInstance;

function useBackwardsCompatibleDataSourceInstance(ref?: Ref): UseDataSourceInstanceResult {
  const [result, setResult] = useState<UseDataSourceInstanceResult>({ isLoading: true });
  // Same key as the host hook, so inline ref objects don't refetch and `null` matches `undefined`.
  const refKey = JSON.stringify(ref ?? null);

  useEffect(() => {
    let isCurrent = true;
    setResult((previous) => ({ ...previous, isLoading: true }));

    getDataSourceInstance(ref).then(
      (dataSource) => isCurrent && setResult({ isLoading: false, dataSource }),
      (error: Error) => isCurrent && setResult({ isLoading: false, error })
    );

    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refKey]);

  return result;
}
