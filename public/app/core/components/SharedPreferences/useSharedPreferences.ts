import { useCallback } from 'react';

import {
  useListPreferencesQuery,
  useUpdatePreferencesMutation,
  type PreferencesSpec,
} from '@grafana/api-clients/rtkq/preferences/v1alpha1';

import { type Props } from './utils';

export const useSharedPreferences = (preferencesName: Props['resourceUri']) => {
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
      preferences: data?.items[0]?.spec,
      isLoading,
      /**
       * After saving preferences, RTK query refetches the preferences
       * However we also reloads the page what causes the refetch to momentarily error while the window is reloading
       * so we need to suppress it
       */
      isError: updateData ? false : isError,
      isUpdating,
      isUpdateError,
    },
  ] as const;
};
