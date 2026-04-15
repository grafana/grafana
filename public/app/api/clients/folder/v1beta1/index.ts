import { generatedAPI } from '@grafana/api-clients/rtkq/folder/v1beta1';
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
