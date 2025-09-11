import { DescendantCount } from 'app/types/folders';

import { generatedAPI } from './endpoints.gen';
import { getParsedCounts } from './utils';

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
                { type: 'Folder', id: 'LIST' },
                ...result.items
                  .map((folder) => ({ type: 'Folder' as const, id: folder.metadata?.name }))
                  .filter(Boolean),
              ]
            : [{ type: 'Folder', id: 'LIST' }],
      },
      deleteFolder: {
        // We don't want delete to invalidate getFolder tags, as that would lead to unnecessary 404s
        invalidatesTags: (result, error) => (error ? [] : [{ type: 'Folder', id: 'LIST' }]),
      },
      updateFolder: {
        query: (queryArg) => ({
          url: `/folders/${queryArg.name}`,
          method: 'PATCH',
          // We need to stringify the body and set the correct header for the call to work with k8s api.
          body: JSON.stringify(queryArg.patch),
          headers: {
            'Content-Type': 'application/strategic-merge-patch+json',
          },
          params: {
            pretty: queryArg.pretty,
            dryRun: queryArg.dryRun,
            fieldManager: queryArg.fieldManager,
            fieldValidation: queryArg.fieldValidation,
            force: queryArg.force,
          },
        }),
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
          const results = await Promise.all(promises);

          const mapped = results.reduce((acc, result) => {
            const { data } = result;

            const counts = getParsedCounts(data?.counts ?? []);
            acc.folders += counts.folders;
            acc.dashboards += counts.dashboards;
            acc.alertrules += counts.alertrules;
            acc.library_elements += counts.library_elements;
            return acc;
          }, initialCounts);

          return { data: mapped };
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
export { type Folder, type FolderList, type CreateFolderApiArg, type ReplaceFolderApiArg } from './endpoints.gen';
