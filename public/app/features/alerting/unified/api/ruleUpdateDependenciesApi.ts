import { miniSerializeError } from '@reduxjs/toolkit';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';

import { alertingApi } from './alertingApi';

export const ruleUpdateDependenciesApi = alertingApi.injectEndpoints({
  endpoints: (builder) => ({
    getRulePluginEnabled: builder.query<boolean, string>({
      queryFn: async (pluginId) => {
        try {
          return { data: await getAppPluginEnabled(pluginId) };
        } catch (error) {
          const cause = error instanceof Error && error.cause ? error.cause : error;
          return { error: isFetchError(cause) ? cause : miniSerializeError(error) };
        }
      },
      providesTags: (_result, _error, pluginId) => [{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }],
    }),
  }),
});
