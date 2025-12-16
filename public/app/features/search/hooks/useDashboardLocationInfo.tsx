import { useAsync } from 'react-use';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { LocationInfo } from 'app/features/search/service/types';

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
