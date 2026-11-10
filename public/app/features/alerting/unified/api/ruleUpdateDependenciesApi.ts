import { miniSerializeError } from '@reduxjs/toolkit';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';
import { requestPermissionQuery } from 'app/core/utils/permissionLookupQuery';

import { alertingApi } from './alertingApi';

export const ruleUpdateDependenciesApi = alertingApi.injectEndpoints({
  endpoints: (builder) => ({
    getRulePluginEnabled: builder.query<boolean, string>({
      queryFn: (pluginId, api) =>
        requestPermissionQuery(async () => {
          try {
            return { data: await getAppPluginEnabled(pluginId) };
          } catch (error) {
            const cause = error instanceof Error && error.cause ? error.cause : error;
            return { error: isFetchError(cause) ? cause : miniSerializeError(error) };
          }
        }, api.signal),
      providesTags: (_result, _error, pluginId) => [{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }],
    }),
  }),
});
