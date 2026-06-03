import { useMemo } from 'react';

import { useGetUserPreferencesQuery } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';

import { contextSrv } from '../../../services/context_srv';

export const useNavbarPreferences = () => {
  const isSignedIn = contextSrv.user.isSignedIn;
  const preferences = useGetUserPreferencesQuery(undefined, { skip: !isSignedIn });
  const navbar = preferences.data?.navbar;
  const isLoading = isSignedIn && !preferences.data && !preferences.isError;

  return useMemo(
    () => ({
      pinnedItems: navbar?.bookmarkUrls || [],
      jobRole: navbar?.jobRole,
      isLoading,
    }),
    [isLoading, navbar?.bookmarkUrls, navbar?.jobRole]
  );
};

export const usePinnedItems = () => {
  return useNavbarPreferences().pinnedItems;
};
