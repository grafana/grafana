import { generatedAPI } from './endpoints.gen';

export const playlistAPI = generatedAPI;
export const { useGetPlaylistQuery, useListPlaylistQuery } = playlistAPI;
