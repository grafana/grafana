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
       * Suppress errors after updating preferences because RTK automatically refetches the preferences after updating,
       * but we also reload the page. This cancels the request, and causes a momentary error state while refreshing.
       */
      isError: updateData ? false : isError,
      isUpdating,
      isUpdateError,
    },
  ] as const;
};
