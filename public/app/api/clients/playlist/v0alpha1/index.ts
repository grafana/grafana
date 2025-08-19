import { getBackendSrv } from '@grafana/runtime';

import { notifyApp } from '../../../../core/actions';
import { createSuccessNotification } from '../../../../core/copy/appNotification';
import { contextSrv } from '../../../../core/services/context_srv';
import { handleError } from '../../../utils';

import { generatedAPI, Playlist, PlaylistSpec } from './endpoints.gen';

export const playlistAPIv0alpha1 = generatedAPI.enhanceEndpoints({
  endpoints: {
    getPlaylist: {
      transformResponse: async (response: Playlist) => {
        await migrateInternalIDs(response.spec);
        return response;
      },
    },
    createPlaylist: (endpointDefinition) => {
      const originalQuery = endpointDefinition.query;
      if (!originalQuery) {
        return;
      }

      endpointDefinition.query = (requestOptions) => {
        const metadata = requestOptions.playlist.metadata;
        if (metadata && !metadata.name && !metadata.generateName) {
          // GenerateName lets the apiserver create a new uid for the name
          // The passed in value is the suggested prefix
          metadata.generateName = contextSrv.user.login?.slice(0, 2) || 'g';
        }
        return originalQuery(requestOptions);
      };

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

/** @deprecated -- this migrates playlists saved with internal ids to uid  */
async function migrateInternalIDs(playlist?: PlaylistSpec) {
  if (playlist?.items) {
    for (const item of playlist.items) {
      if (item.type === 'dashboard_by_id') {
        item.type = 'dashboard_by_uid';
        const uids = await getBackendSrv().get<string[]>(`/api/dashboards/ids/${item.value}`);
        if (uids?.length) {
          item.value = uids[0];
        }
      }
    }
  }
}

export const {
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  useGetPlaylistQuery,
  useListPlaylistQuery,
  useReplacePlaylistMutation,
} = playlistAPIv0alpha1;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { Playlist, PlaylistSpec } from './endpoints.gen';
