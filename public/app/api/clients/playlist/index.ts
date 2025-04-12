import { notifyApp } from '../../../core/actions';
import { createSuccessNotification } from '../../../core/copy/appNotification';
import { contextSrv } from '../../../core/services/context_srv';
import { handleError } from '../../utils';

import { generatedAPI } from './endpoints.gen';

export const playlistAPI = generatedAPI.enhanceEndpoints({
  endpoints: {
    createPlaylist: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (originalQuery) {
        endpointDefinition.query = (requestOptions) => {
          if (!requestOptions.playlist.metadata.name && !requestOptions.playlist.metadata.generateName) {
            const login = contextSrv.user.login;
            // GenerateName lets the apiserver create a new uid for the name
            // The passed in value is the suggested prefix
            requestOptions.playlist.metadata.generateName = login ? login.slice(0, 2) : 'g';
          }
          return originalQuery(requestOptions);
        };
      }
      endpointDefinition.onQueryStarted = async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist created')));
        } catch (e) {
          handleError(e, dispatch, 'Unable to create playlist');
        }
      };
    },
    replacePlaylist: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist updated')));
        } catch (e) {
          handleError(e, dispatch, 'Unable to update playlist');
        }
      },
    },
    deletePlaylist: {
      onQueryStarted: async (_, { queryFulfilled, dispatch }) => {
        try {
          await queryFulfilled;
          dispatch(notifyApp(createSuccessNotification('Playlist deleted')));
        } catch (e) {
          handleError(e, dispatch, 'Unable to delete playlist');
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
