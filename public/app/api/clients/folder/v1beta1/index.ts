import { generatedAPI } from './endpoints.gen';

export const folderAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
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
});

export const { useGetFolderQuery, useGetFolderParentsQuery, useDeleteFolderMutation, useUpdateFolderMutation } =
  folderAPIv1beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type FolderList } from './endpoints.gen';
