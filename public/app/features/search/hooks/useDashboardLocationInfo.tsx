import { useMemo } from 'react';
import { useAsync } from 'react-use';

import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { LocationInfo } from 'app/features/search/service/types';

export function useDashboardLocationInfo(enabled: boolean) {
  const searcher = useMemo(() => getGrafanaSearcher(), []);
  const {
    value: folders,
    loading,
    error,
  } = useAsync(async (): Promise<Record<string, LocationInfo>> => {
    if (!enabled) {
      return {};
    }
    return searcher.getLocationInfo();
  }, [enabled, searcher]);

  return {
    foldersByUid: folders ?? {},
    loading,
    error,
  };
}
