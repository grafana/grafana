import { useMemo } from 'react';

import { config } from '@grafana/runtime';
import { useGetUserPreferencesQuery } from 'app/features/preferences/api';

import { contextSrv } from '../../../services/context_srv';

export const usePinnedItems = () => {
  const preferences = useGetUserPreferencesQuery(undefined, { skip: !contextSrv.user.isSignedIn });
  const pinnedItems = useMemo(() => preferences.data?.navbar?.bookmarkUrls || [], [preferences]);

  if (config.featureToggles.pinNavItems) {
    return pinnedItems;
  }
  return [];
};
