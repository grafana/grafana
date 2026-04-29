import { generatedAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { invalidateQuotaUsage } from '@grafana/api-clients/rtkq/quotas/v0alpha1';
import { PAGE_SIZE } from 'app/features/browse-dashboards/api/services';
import { refetchChildren } from 'app/features/browse-dashboards/state/actions';
import { TEAM_FOLDERS_UID } from 'app/features/search/constants';
import { dispatch } from 'app/store/store';
import { type DescendantCount } from 'app/types/folders';

import { getParsedCounts } from './utils';

const folderListTag = { type: 'Folder' as const, id: 'LIST' };

export const folderAPIv1beta1 = generatedAPI
  .enhanceEndpoints({
    endpoints: {
      getFolder: {
        providesTags: (result, error, arg) => (result ? [{ type: 'Folder', id: arg.name }] : []),
      },
      listFolder: {
        providesTags: (result) =>
          result
            ? [
                folderListTag,
                ...result.items
                  .map((folder) => ({ type: 'Folder' as const, id: folder.metadata?.name }))
                  .filter(Boolean),
              ]
            : [folderListTag],
      },
      deleteFolder: {
        invalidatesTags: (_result, error) => (error ? [] : [folderListTag]),
        onQueryStarted: async (arg, { queryFulfilled }) => {
          try {
            await queryFulfilled;
            // TODO the args are different than in old browseDashboardAPI so we don't have parent ready here,
            //   we probably need to get the full folder somehow before deleting or changing the arg
            // dispatch(refetchChildren({ parentUID: parentUid, pageSize: PAGE_SIZE }));
            dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
            invalidateQuotaUsage(dispatch);
          } catch {
            // Error handled by mutation caller
          }
        },
      },
      updateFolder: {
        onQueryStarted: async ({ patch }, { queryFulfilled }) => {
          try {
            if (
              Array.isArray(patch) &&
              patch.length &&
              patch.some((part) => 'path' in part && part.path === '/metadata/ownerReferences')
            ) {
              await queryFulfilled;
              dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
            }
          } catch {
            // Error handled by mutation caller
          }
        },
      },
      createFolder: {
        onQueryStarted: async ({ folder }, { queryFulfilled }) => {
          try {
            if (folder.metadata?.ownerReferences && folder.metadata?.ownerReferences.length) {
              await queryFulfilled;
              dispatch(refetchChildren({ parentUID: TEAM_FOLDERS_UID, pageSize: PAGE_SIZE }));
            }
          } catch {
            // Error handled by mutation caller
          }
        },
      },
    },
  })
  .injectEndpoints({
    endpoints: (builder) => ({
      getAffectedItems: builder.query<Record<string, number>, { folderUIDs: string[]; dashboardUIDs: string[] }>({
        // Similar to legacy API, don't cache this data as we don't have full knowledge of the descendant entities
        // and when they're created/deleted, so we can't easily know when this data is stale
        keepUnusedDataFor: 0,
        queryFn: async ({ folderUIDs, dashboardUIDs }, queryApi) => {
          const initialCounts: DescendantCount = {
            folders: folderUIDs.length,
            dashboards: dashboardUIDs.length,
            library_elements: 0,
            alertrules: 0,
          };

          const promises = folderUIDs.map(async (folderUID) =>
            queryApi.dispatch(generatedAPI.endpoints.getFolderCounts.initiate({ name: folderUID }))
          );
          try {
            const results = await Promise.all(promises);

            const mapped = results.reduce((acc, result) => {
              const { data, error } = result;
              if (error) {
                throw error;
              }

              const counts = getParsedCounts(data?.counts ?? []);
              acc.folders += counts.folders;
              acc.dashboards += counts.dashboards;
              acc.alertrules += counts.alertrules;
              acc.library_elements += counts.library_elements;
              return acc;
            }, initialCounts);

            return { data: mapped };
          } catch (error) {
            return { error };
          }
        },
      }),
    }),
  });

export const {
  useGetFolderQuery,
  useGetFolderParentsQuery,
  useDeleteFolderMutation,
  useCreateFolderMutation,
  useUpdateFolderMutation,
  useReplaceFolderMutation,
  useGetAffectedItemsQuery,
} = folderAPIv1beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export * from '@grafana/api-clients/rtkq/folder/v1beta1';
