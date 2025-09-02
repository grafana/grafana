import { generatedAPI } from './endpoints.gen';

export const folderAPIv1beta1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    getFolder: {
      providesTags: (result, error, arg) => (result ? [{ type: 'Folder', id: arg.name }] : []),
    },
    listFolder: {
      providesTags: (result) =>
        result
          ? [
              { type: 'Folder', id: 'LIST' },
              ...result.items.map((folder) => ({ type: 'Folder' as const, id: folder.metadata?.name })).filter(Boolean),
            ]
          : [{ type: 'Folder', id: 'LIST' }],
    },
    deleteFolder: {
      // We don't want delete to invalidate getFolder tags, as that would lead to unnecessary 404s
      invalidatesTags: (result, error) => (error ? [] : [{ type: 'Folder', id: 'LIST' }]),
    },
  },
});

export const { useGetFolderQuery, useGetFolderParentsQuery, useDeleteFolderMutation, useCreateFolderMutation } =
  folderAPIv1beta1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export { type Folder, type FolderList, type CreateFolderApiArg } from './endpoints.gen';
