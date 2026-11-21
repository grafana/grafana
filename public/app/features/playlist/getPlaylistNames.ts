import { isFetchError } from '@grafana/runtime';
import { type Playlist, playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { dispatch } from 'app/types/store';

/**
 * Titles of the playlists the user can see, keyed by uid. One list call. A user without playlist access (the call is
 * denied) sees none; any other failure propagates.
 */
export async function getPlaylistNames(): Promise<Map<string, string>> {
  const request = dispatch(playlistAPIv1.endpoints.listPlaylist.initiate({}));
  try {
    const { items } = await request.unwrap();
    return new Map(items.map((playlist: Playlist) => [playlist.metadata.name ?? '', playlist.spec.title]));
  } catch (error) {
    if (isFetchError(error) && error.status === 403) {
      return new Map();
    }
    throw error;
  } finally {
    request.unsubscribe();
  }
}
