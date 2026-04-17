import { skipToken } from '@reduxjs/toolkit/query/react';
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

  const { data: userPrefs, isLoading: isLoadingUser } = useGetUserPreferencesQuery(
    preferenceType !== 'user' ? skipToken : undefined
  );
  const { data: orgPrefs, isLoading: isLoadingOrg } = useGetOrgPreferencesQuery(
    preferenceType !== 'org' ? skipToken : undefined
  );
  const { data: teamPrefs, isLoading: isLoadingTeam } = useGetTeamPreferencesQuery(
    preferenceType !== 'team' ? skipToken : { teamId: teamId! }
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
