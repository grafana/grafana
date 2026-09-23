import { useEffect, useState } from 'react';

import { type DataSourceInstanceListItem } from '@grafana/data';

import { getDefaultDataSourceInstanceListItem } from './getDefaultDataSourceInstanceListItem';

/** Declared here because `@grafana/runtime/unstable` lacks it on older supported hosts. */
export interface UseDefaultDataSourceInstanceListItemResult {
  isLoading: boolean;
  error?: Error;
  item?: DataSourceInstanceListItem;
}

/**
 * React hook wrapping {@link getDefaultDataSourceInstanceListItem}. Re-resolves when the uid or
 * `isDefault` flag of any item changes, so passing an inline array is safe.
 */
export function useDefaultDataSourceInstanceListItem(
  items: DataSourceInstanceListItem[]
): UseDefaultDataSourceInstanceListItemResult {
  const [result, setResult] = useState<UseDefaultDataSourceInstanceListItemResult>({ isLoading: true });
  const itemsKey = JSON.stringify(items.map((item) => [item?.uid, item?.isDefault]));

  useEffect(() => {
    let active = true;
    setResult({ isLoading: true });

    getDefaultDataSourceInstanceListItem(items).then(
      (item) => {
        if (active) {
          setResult({ isLoading: false, item });
        }
      },
      (err: unknown) => {
        if (active) {
          setResult({ isLoading: false, error: err instanceof Error ? err : new Error(String(err)) });
        }
      }
    );

    return () => {
      active = false;
    };
    // Keyed by uid and flag, the only fields the resolver reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  return result;
}
