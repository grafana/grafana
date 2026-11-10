import { miniSerializeError } from '@reduxjs/toolkit';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';
import { schedulePermissionLookup } from 'app/core/utils/permissionLookupQueue';

import { alertingApi } from './alertingApi';

export const ruleUpdateDependenciesApi = alertingApi.injectEndpoints({
  endpoints: (builder) => ({
    getRulePluginEnabled: builder.query<boolean, string>({
      queryFn: async (pluginId, api) => {
        try {
          return { data: await schedulePermissionLookup(() => getAppPluginEnabled(pluginId), api.signal) };
        } catch (error) {
          const cause = error instanceof Error && error.cause ? error.cause : error;
          return { error: isFetchError(cause) ? cause : miniSerializeError(error) };
        }
      },
      providesTags: (_result, _error, pluginId) => [{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }],
    }),
  }),
});
