import { generatedAPI } from './endpoints.gen';

export const playlistAPI = generatedAPI;
export const {
  useCreatePlaylistMutation,
  useDeletePlaylistMutation,
  useGetPlaylistQuery,
  useListPlaylistQuery,
  useReplacePlaylistMutation,
} = playlistAPI;

// eslint-disable-next-line no-barrel-files/no-barrel-files
export type { Playlist } from './endpoints.gen';
