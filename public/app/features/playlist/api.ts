import { getBackendSrv } from '@grafana/runtime';

import { notifyApp } from '../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
import { dispatch } from '../../store/store';

import { Playlist, PlaylistDTO } from './types';

export async function createPlaylist(playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
}

export async function updatePlaylist(uid: string, playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().put(`/api/playlists/${uid}`, playlist));
}

export async function deletePlaylist(uid: string) {
  await withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${uid}`), 'Playlist deleted');
}

export async function getPlaylist(uid: string): Promise<Playlist> {
  const result: Playlist = await getBackendSrv().get(`/api/playlists/${uid}`);
  return result;
}

export async function getAllPlaylist(query: string): Promise<PlaylistDTO[]> {
  const result: PlaylistDTO[] = await getBackendSrv().get('/api/playlists/', { query });
  return result;
}

async function withErrorHandling(apiCall: () => Promise<void>, message = 'Playlist saved') {
  try {
    await apiCall();
    dispatch(notifyApp(createSuccessNotification(message)));
  } catch (e) {
    if (e instanceof Error) {
      dispatch(notifyApp(createErrorNotification('Unable to save playlist', e)));
    }
  }
}
