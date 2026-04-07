import { useCallback } from 'react';

import {
  useGetOrgPreferencesQuery,
  useUpdateOrgPreferencesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/preferences/org';
import {
  useGetTeamPreferencesQuery,
  useUpdateTeamPreferencesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/preferences/team';
import {
  useGetUserPreferencesQuery,
  useUpdateUserPreferencesMutation,
} from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
import { type UpdatePrefsCmd } from 'app/api/clients/legacy';

import { type Props } from './utils';

export const useSharedPreferences = (preferenceType: Props['preferenceType'], resourceUri: Props['resourceUri']) => {
  const teamId = preferenceType === 'team' ? resourceUri.split('/')[1] : undefined;

  const { data: userPrefs, isLoading: isLoadingUser } = useGetUserPreferencesQuery(undefined, {
    skip: preferenceType !== 'user',
  });
  const { data: orgPrefs, isLoading: isLoadingOrg } = useGetOrgPreferencesQuery(undefined, {
    skip: preferenceType !== 'org',
  });
  const { data: teamPrefs, isLoading: isLoadingTeam } = useGetTeamPreferencesQuery(
    { teamId: teamId! },
    { skip: preferenceType !== 'team' }
  );

  const [updateUserPreferences, { isLoading: isSubmittingUser }] = useUpdateUserPreferencesMutation();
  const [updateOrgPreferences, { isLoading: isSubmittingOrg }] = useUpdateOrgPreferencesMutation();
  const [updateTeamPreferences, { isLoading: isSubmittingTeam }] = useUpdateTeamPreferencesMutation();

  const prefs = userPrefs ?? orgPrefs ?? teamPrefs;
  const isLoading = isLoadingUser || isLoadingOrg || isLoadingTeam;
  const isSubmitting = isSubmittingUser || isSubmittingOrg || isSubmittingTeam;

  const updatePreferences = useCallback(
    (prefsData: UpdatePrefsCmd) => {
      if (preferenceType === 'user') {
        return updateUserPreferences({ updatePrefsCmd: prefsData }).unwrap();
      } else if (preferenceType === 'org') {
        return updateOrgPreferences({ updatePrefsCmd: prefsData }).unwrap();
      } else {
        return updateTeamPreferences({ teamId: teamId!, updatePrefsCmd: prefsData }).unwrap();
      }
    },
    [preferenceType, teamId, updateUserPreferences, updateOrgPreferences, updateTeamPreferences]
  );

  return [updatePreferences, { preferences: prefs, isLoading, isSubmitting }] as const;
};
