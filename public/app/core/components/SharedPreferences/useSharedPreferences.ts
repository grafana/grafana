import { useCallback } from 'react';

import {
  useListPreferencesQuery,
  useUpdatePreferencesMutation,
  type PreferencesSpec,
} from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { type Props } from './utils';

export const useSharedPreferences = (
  preferenceType: Props['preferenceType'],
  preferencesName: Props['resourceUri'],
  metadataName: string
) => {
  /**
   * TODO: change to use listPreferences with fieldSelector=metadata.name={name} instead of getPreferences
   * and unwrap the array to return just the one preference object
   *
   * todo list:
   * - [x] get user preferences
   * - [x] get team preferences
   * - [ ] get org preferences
   *
   * - [x] update user preferences
   * - [ ] update team preferences
   * - [ ] update org preferences
   *
   * ~~~ context ~~~
   *
   * getPreferences: /apis/preferences.grafana.app/v1alpha1/namespaces/{namespace}/preferences/{name}
   *   - gets the preferences for {name}
   *   - returns 404 if doesn't exist (empty preferences)
   *
   *  ~~~ or ~~~
   *
   * listPreferences: /apis/preferences.grafana.app/v1alpha1/preferences?fieldSelector=metadata.name={name}
   *  - returns an array of preferences that match the filter (metadata.name={name}) // {name} = user-123, team-456, namespace
   *  - if preferences don't exist, the array is just empty
   *
   * listPreferences: /apis/preferences.grafana.app/v1alpha1/preferences
   *  - returns an array of ALL preferences for the user - user, team, org
   *  - if preferences don't exist, the array is just empty
   *
   */

  const { data, isLoading, isError } = useListPreferencesQuery({ fieldSelector: `metadata.name=${preferencesName}` });
  const [updatePreferences, { data: updateData, isLoading: isUpdating, isError: isUpdateError }] =
    useUpdatePreferencesMutation();

  const updatePreferencesWrapped = useCallback(
    (prefsData: Partial<PreferencesSpec>) => {
      return updatePreferences({ patch: { spec: prefsData }, name: preferencesName }).unwrap();
    },
    [preferencesName, updatePreferences]
  );
  return [
    updatePreferencesWrapped,
    {
      preferences: updateData?.spec ?? data?.items[0]?.spec,
      isLoading,
      isError,
      isSubmitting: isUpdating,
      isUpdateError,
    },
  ] as const;
};
