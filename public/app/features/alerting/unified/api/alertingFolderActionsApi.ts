import { alertingApi } from './alertingApi';

export const alertingFolderActionsApi = alertingApi.injectEndpoints({
  endpoints: (build) => ({
    pauseFolder: build.mutation<
      void,
      {
        folderUID: string;
      }
    >({
      query: ({ folderUID }) => ({
        url: `/api/???`,
        method: 'POST',
        body: {
          folderUID,
        },
      }),
    }),
    unpauseFolder: build.mutation<
      void,
      {
        folderUID: string;
      }
    >({
      query: ({ folderUID }) => ({
        url: `/api/???`,
        method: 'POST',
        body: {
          folderUID,
        },
      }),
    }),
  }),
});
