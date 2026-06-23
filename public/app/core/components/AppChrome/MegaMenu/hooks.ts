import { useMemo } from 'react';

import { useGetUserPreferencesQuery } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { useListPreferencesQuery } from '@grafana/api-clients/rtkq/preferences/v1alpha1';
import { useFlagGrafanaNewPreferencesPage } from '@grafana/runtime/internal';

import { contextSrv } from '../../../services/context_srv';

export const usePinnedItems = () => {
  const newPrefsEnabled = useFlagGrafanaNewPreferencesPage();
  const { data: preferencesK8s } = useListPreferencesQuery(
    { fieldSelector: `metadata.name=user-${contextSrv.user.uid}` },
    { skip: !contextSrv.user.isSignedIn || !newPrefsEnabled }
  );
  // TODO remove this when newPrefsEnabled is fully rolled out
  const { data: preferencesLegacy } = useGetUserPreferencesQuery(undefined, {
    skip: !contextSrv.user.isSignedIn || newPrefsEnabled,
  });

  const preferences = newPrefsEnabled ? preferencesK8s?.items[0].spec : preferencesLegacy;
  const pinnedItems = useMemo(() => preferences?.navbar?.bookmarkUrls || [], [preferences]);

  return pinnedItems;
};
