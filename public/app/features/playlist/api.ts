import { getBackendSrv } from '@grafana/runtime';

import { Playlist, PlaylistDTO } from './types';
import { dispatch } from '../../store/store';
import { notifyApp } from '../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';

export async function createPlaylist(playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
}

export async function updatePlaylist(id: number, playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().put(`/api/playlists/${id}`, playlist));
}

export async function deletePlaylist(id: number) {
  await withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${id}`), 'Playlist deleted');
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const result: Playlist = await getBackendSrv().get(`/api/playlists/${id}`);
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
    dispatch(notifyApp(createErrorNotification('Unable to save playlist', e)));
  }
}
