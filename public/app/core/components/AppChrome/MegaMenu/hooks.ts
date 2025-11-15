import { useMemo } from 'react';

import { useGetUserPreferencesQuery } from '@grafana/api-clients/rtkq/legacy/preferences';
import { config } from '@grafana/runtime';

import { contextSrv } from '../../../services/context_srv';

export const usePinnedItems = () => {
  const preferences = useGetUserPreferencesQuery(undefined, { skip: !contextSrv.user.isSignedIn });
  const pinnedItems = useMemo(() => preferences.data?.navbar?.bookmarkUrls || [], [preferences]);

  if (config.featureToggles.pinNavItems) {
    return pinnedItems;
  }
  return [];
};
