import { notifyApp } from '../../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../../core/copy/appNotification';

import { generatedAPI } from './endpoints.gen';

export const playlistAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    createPlaylist: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist created')));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(notifyApp(createErrorNotification('Unable to create playlist', e)));
          }
        }
      },
    },
    replacePlaylist: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist updated')));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(notifyApp(createErrorNotification('Unable to update playlist', e)));
          }
        }
      },
    },
    deletePlaylist: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist deleted')));
        } catch (e) {
          if (e instanceof Error) {
            dispatch(notifyApp(createErrorNotification('Unable to delete playlist', e)));
          }
        }
      },
    },
  },
});
export const {
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  useGetPlaylistQuery,
  useListPlaylistQuery,
  useReplacePlaylistMutation,
} = playlistAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { Playlist } from './endpoints.gen';
