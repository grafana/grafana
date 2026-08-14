import { useCallback, useMemo } from 'react';

import { useURLSearchParams } from './useURLSearchParams';

/**
 * Read and write a single query string key for "drawer open" or similar overlay state.
 * Uses `locationService.partial` via {@link useURLSearchParams} so the change merges with
 * other params (e.g. `tab`, `from`, or feature-specific filters on the same page).
 *
 * @param paramKey - query parameter name; must not collide with other keys on the same route
 * @returns `value` (null if absent) and `setValue` to set or clear the key. Pass `replace: true` to
 *   avoid a new history entry (e.g. when stripping an invalid or stale value).
 */
export function useSyncedUrlDrawerParam(paramKey: string): {
  value: string | null;
  setValue: (next: string | null, replace?: boolean) => void;
} {
  const [searchParams, setSearchParams] = useURLSearchParams();
  const value = useMemo(() => searchParams.get(paramKey) ?? null, [paramKey, searchParams]);

  const setValue = useCallback(
    (next: string | null, replace = false) => {
      setSearchParams(
        {
          [paramKey]: next ?? undefined,
        },
        replace
      );
    },
    [paramKey, setSearchParams]
  );

  return { value, setValue };
}
