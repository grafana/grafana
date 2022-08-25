import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, DataFrameView } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';

import { notifyApp } from '../../core/actions';
import { createErrorNotification, createSuccessNotification } from '../../core/copy/appNotification';
import { dispatch } from '../../store/store';
import { DashboardQueryResult, SearchQuery } from '../search/service';

import { Playlist, PlaylistItem, PlaylistDTO, PlaylistItemsWithDashboards } from './types';

export async function createPlaylist(playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
}

export async function updatePlaylist(uid: string, playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().put(`/api/playlists/${uid}`, playlist));
}

export async function deletePlaylist(uid: string) {
  await withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${uid}`), 'Playlist deleted');
}

/** This returns a playlist where all ids are replaced with UIDs */
export async function getPlaylist(uid: string): Promise<Playlist> {
  const playlist = await getBackendSrv().get<Playlist>(`/api/playlists/${uid}`);
  if (playlist.items) {
    for (const item of playlist.items) {
      if (item.type === 'dashboard_by_id') {
        item.type = 'dashboard_by_uid';
        const uids = await getBackendSrv().get<string[]>(`/api/dashboards/ids/${item.value}`);
        if (uids.length) {
          item.value = uids[0];
        }
      }
    }
  }
  return playlist;
}

export async function getAllPlaylist(query: string): Promise<PlaylistDTO[]> {
  return getBackendSrv().get<PlaylistDTO[]>('/api/playlists/', { query });
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

/** Returns an augmented playlist where each item contains its body */
export async function loadDashboards(items: PlaylistItem[]): Promise<PlaylistItemsWithDashboards[]> {
  let idx = 0;
  const targets: GrafanaQuery[] = [];
  for (const item of items) {
    const query: SearchQuery = {
      query: '*',
      kind: ['dashboard'],
      limit: 1000,
    };

    switch (item.type) {
      case 'dashboard_by_id':
        throw new Error('invalid item (with id)');

      case 'dashboard_by_uid':
        query.uid = [item.value];
        break;

      case 'dashboard_by_tag':
        query.tags = [item.value];
        break;
    }
    targets.push({
      refId: `${idx++}`,
      queryType: GrafanaQueryType.Search,
      search: query,
    });
  }

  const ds = await getGrafanaDatasource();
  // eslint-disable-next-line
  const rsp = await lastValueFrom(ds.query({ targets } as unknown as DataQueryRequest<GrafanaQuery>));
  if (rsp.data.length !== items.length) {
    throw new Error('unexpected result size');
  }
  return items.map((item, idx) => {
    const view = new DataFrameView<DashboardQueryResult>(rsp.data[idx]);
    return { ...item, dashboards: view.map((v) => ({ ...v })) };
  });
}
