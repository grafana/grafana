import { getBackendSrv } from '@grafana/runtime';

import { Playlist } from './types';
import { dispatch } from '../../store/store';
import { notifyApp } from '../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';

export async function createPlaylist(playlist: Playlist) {
  await withErrorHandling(async () => await getBackendSrv().post('/api/playlists', playlist));
}

export async function updatePlaylist(id: number, playlist: Playlist) {
  await withErrorHandling(async () => await getBackendSrv().put(`/api/playlists/${id}`, playlist));
}

export async function deletePlaylist(id: number) {
  await withErrorHandling(async () => await getBackendSrv().delete(`/api/playlists/${id}`));
}

export async function getPlaylist(id: number): Promise<Playlist> {
  const result: Playlist = await getBackendSrv().get(`/api/playlists/${id}`);
  return result;
}

async function withErrorHandling(apiCall: () => Promise<void>) {
  try {
    await apiCall();
    dispatch(notifyApp(createSuccessNotification('Playlist saved')));
  } catch (e) {
    dispatch(notifyApp(createErrorNotification('Unable to save playlist', e)));
  }
}
