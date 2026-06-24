import { skipToken } from '@reduxjs/toolkit/query';
import { useMemo } from 'react';

import { useGetUserPreferencesQuery } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { useListPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';

import { contextSrv } from '../../../services/context_srv';

export const usePinnedItems = () => {
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const { data: preferencesK8s } = useListPreferencesQuery(
    contextSrv.user.isSignedIn && newPrefsEnabled
      ? { fieldSelector: `metadata.name=user-${contextSrv.user.uid}` }
      : skipToken
  );
  // TODO remove this when newPrefsEnabled is fully rolled out
  const { data: preferencesLegacy } = useGetUserPreferencesQuery(
    contextSrv.user.isSignedIn && !newPrefsEnabled ? undefined : skipToken
  );

  const preferences = newPrefsEnabled ? preferencesK8s?.items[0]?.spec : preferencesLegacy;
  const pinnedItems = useMemo(() => preferences?.navbar?.bookmarkUrls || [], [preferences]);

  return pinnedItems;
};
