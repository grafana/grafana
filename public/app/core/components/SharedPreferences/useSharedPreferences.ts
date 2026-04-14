import { useCallback } from 'react';

import {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  type PreferencesSpec,
} from '@grafana/api-clients/rtkq/preferences/v1alpha1';

// import {
//   useGetOrgPreferencesQuery,
//   useUpdateOrgPreferencesMutation,
// } from '@grafana/api-clients/internal/rtkq/legacy/preferences/org';
// import {
//   useGetTeamPreferencesQuery,
//   useUpdateTeamPreferencesMutation,
// } from '@grafana/api-clients/internal/rtkq/legacy/preferences/team';
// import {
//   useGetUserPreferencesQuery,
//   useUpdateUserPreferencesMutation,
// } from '@grafana/api-clients/internal/rtkq/legacy/preferences/user';
// import { type UpdatePrefsCmd } from 'app/api/clients/legacy';

import { type Props } from './utils';

/**
 * getPreferences
 *  - called with {namespace} (should already be provided by the generated hook)
 *  - {name} - `user-{userUID}`, `team-{teamId}`
 *
 * todo list:
 * - [x] get user preferences
 * - [ ] get org preferences
 * - [ ] get team preferences
 *
 * - [ ] update user preferences
 * - [ ] update team preferences
 * - [ ] update org preferences
 */

export const useSharedPreferences = (
  preferenceType: Props['preferenceType'],
  preferencesName: Props['resourceUri']
) => {
  const { data, isLoading, isError } = useGetPreferencesQuery({ name: preferencesName });
  const [updatePreferences, { data: updateData, isLoading: isUpdating, isError: isUpdateError }] =
    useUpdatePreferencesMutation();

  const updatePreferencesWrapped = useCallback(
    (prefsData: Partial<PreferencesSpec>) => {
      console.log('Updating preferences with data:', prefsData);
      return updatePreferences({ patch: { spec: prefsData }, name: preferencesName }).unwrap();
      // TODO - implement update preferences mutation
    },
    [preferencesName, updatePreferences]
  );

  return [
    updatePreferencesWrapped,
    { preferences: data?.spec, isLoading, isError, isSubmitting: isUpdating, isUpdateError },
  ] as const;

  /**
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
   
   */

  // return [updatePreferences, { preferences: prefs, isLoading, isSubmitting }] as const;
};
