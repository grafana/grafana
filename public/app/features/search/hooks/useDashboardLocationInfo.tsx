import { useAsync } from 'react-use';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { LocationInfo } from 'app/features/search/service/types';

/**
 *
 * @description Hook to fetch dashboard location info (folders).
 * @returns An object containing a mapping of folder UIDs to LocationInfo, loading state, and error state.
 */
export function useDashboardLocationInfo(enabled: boolean) {
  const searcher = getGrafanaSearcher();
  const {
    value: foldersByUid,
    loading,
    error,
  } = useAsync(async (): Promise<Record<string, LocationInfo>> => {
    if (!enabled) {
      return {};
    }
    return searcher.getLocationInfo();
  }, [enabled, searcher]);

  return {
    foldersByUid: foldersByUid ?? {},
    loading,
    error,
  };
}
