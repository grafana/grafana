import { miniSerializeError } from '@reduxjs/toolkit';
import { type BaseQueryFn, retry } from '@reduxjs/toolkit/query';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';
import { permissionLookupRetryOptions } from 'app/core/utils/permissionLookupQuery';
import { schedulePermissionLookup } from 'app/core/utils/permissionLookupQueue';

import { alertingApi } from './alertingApi';

const fetchRulePluginEnabled = retry<BaseQueryFn<string, boolean>>(async (pluginId, api) => {
  try {
    return { data: await schedulePermissionLookup(() => getAppPluginEnabled(pluginId), api.signal) };
  } catch (error) {
    const cause = error instanceof Error && error.cause ? error.cause : error;
    return { error: isFetchError(cause) ? cause : miniSerializeError(error) };
  }
}, permissionLookupRetryOptions);

export const ruleUpdateDependenciesApi = alertingApi.injectEndpoints({
  endpoints: (builder) => ({
    getRulePluginEnabled: builder.query<boolean, string>({
      queryFn: (pluginId, api) => fetchRulePluginEnabled(pluginId, api, {}),
      providesTags: (_result, _error, pluginId) => [{ type: 'RulePluginEnabled', id: `plugin:${pluginId}` }],
    }),
  }),
});
