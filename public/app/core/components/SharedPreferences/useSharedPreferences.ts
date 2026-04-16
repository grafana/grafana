import { useCallback } from 'react';

import {
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  type PreferencesSpec,
} from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { type Props } from './utils';

export const useSharedPreferences = (
  preferenceType: Props['preferenceType'],
  preferencesName: Props['resourceUri']
) => {
  const { data, isLoading, isError } = useGetPreferencesQuery({ name: preferencesName });
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
    { preferences: updateData?.spec ?? data?.spec, isLoading, isError, isSubmitting: isUpdating, isUpdateError },
  ] as const;
};
