import { miniSerializeError } from '@reduxjs/toolkit';
import { type BaseQueryFn, retry } from '@reduxjs/toolkit/query';

import { getAppPluginEnabled, isFetchError } from '@grafana/runtime';
import { folderAPIv1beta1, getFolderTag } from 'app/api/clients/folder/v1beta1';
import { permissionLookupRetryOptions } from 'app/core/utils/permissionLookupQuery';
import { schedulePermissionLookup } from 'app/core/utils/permissionLookupQueue';
import { browseDashboardsAPI, folderTag } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { type FolderDTO } from 'app/types/folders';

import { alertingApi } from './alertingApi';

type FolderPermissions = Pick<FolderDTO, 'accessControl'>;

const fetchRuleFolderPermissions = retry<BaseQueryFn<{ uid: string; appPlatform: boolean }, FolderPermissions>>(
  async ({ uid, appPlatform }, api) => {
    try {
      // Refetch each attempt because a rejected canonical query can retain old data.
      const options = { subscribe: false, forceRefetch: true };
      const data = await schedulePermissionLookup<FolderPermissions>(
        () =>
          appPlatform
            ? api.dispatch(folderAPIv1beta1.endpoints.getFolderAccess.initiate({ name: uid }, options)).unwrap()
            : api
                .dispatch(
                  browseDashboardsAPI.endpoints.getFolder.initiate(
                    { folderUID: uid, accesscontrol: true, isLegacyCall: false },
                    options
                  )
                )
                .unwrap(),
        api.signal
      );
      return { data };
    } catch (error) {
      return { error };
    }
  },
  permissionLookupRetryOptions
);

export const ruleFolderPermissionsApi = folderAPIv1beta1.injectEndpoints({
  endpoints: (builder) => ({
    getBulkRuleFolderPermissions: builder.query<FolderPermissions, string>({
      queryFn: (uid, api) => fetchRuleFolderPermissions({ uid, appPlatform: true }, api, {}),
      providesTags: (_result, _error, uid) => [getFolderTag(uid)],
    }),
  }),
});

export const legacyRuleFolderPermissionsApi = browseDashboardsAPI.injectEndpoints({
  endpoints: (builder) => ({
    getBulkRuleFolderPermissions: builder.query<FolderPermissions, string>({
      queryFn: (uid, api) => fetchRuleFolderPermissions({ uid, appPlatform: false }, api, {}),
      providesTags: (_result, _error, uid) => [folderTag(uid)],
    }),
  }),
});

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
