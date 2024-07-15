import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { useGetUserPreferencesQuery } from 'app/features/preferences/api';

export const usePinnedItems = () => {
  const preferences = useGetUserPreferencesQuery();
  const pinnedItems = useMemo(() => preferences.data?.navbar?.bookmarkIds || [], [preferences]);

  if (config.featureToggles.pinNavItems) {
    return pinnedItems;
  }
  return [];
};
