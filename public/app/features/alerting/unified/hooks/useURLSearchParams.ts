import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { locationService } from '@grafana/runtime';

export function useURLSearchParams(): [
  URLSearchParams,
  (searchValues: Record<string, string | string[]>, replace?: boolean) => void
] {
  const { search } = useLocation();
  const queryParams = useMemo(() => new URLSearchParams(search), [search]);

  const update = useCallback((searchValues: Record<string, string | string[]>, replace?: boolean) => {
    locationService.partial(searchValues, replace);
  }, []);

  return [queryParams, update];
}
