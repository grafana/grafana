import { useMemo } from 'react';

import { useGetUserPreferencesQuery } from '@grafana/api-clients/rtkq/legacy/preferences';

import { contextSrv } from '../../../services/context_srv';

export const usePinnedItems = () => {
  const preferences = useGetUserPreferencesQuery(undefined, { skip: !contextSrv.user.isSignedIn });
  const pinnedItems = useMemo(() => preferences.data?.navbar?.bookmarkUrls || [], [preferences]);

  return pinnedItems;
};
