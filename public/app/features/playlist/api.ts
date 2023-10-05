import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, DataFrameView } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { dispatch } from 'app/store/store';

import { DashboardQueryResult, getGrafanaSearcher, SearchQuery } from '../search/service';

import { Playlist, PlaylistItem, KubernetesPlaylist, KubernetesPlaylistList, PlaylistAPI } from './types';

export async function createPlaylist(playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
}

export async function updatePlaylist(uid: string, playlist: Playlist) {
  await withErrorHandling(() => getBackendSrv().put(`/api/playlists/${uid}`, playlist));
}

export async function deletePlaylist(uid: string) {
  await withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${uid}`), 'Playlist deleted');
}

export const playlistAPI: PlaylistAPI = {
  getPlaylist: config.featureToggles.kubernetesPlaylists ? k8sGetPlaylist : legacyGetPlaylist,
  getAllPlaylist: config.featureToggles.kubernetesPlaylists ? k8sGetAllPlaylist : legacyGetAllPlaylist,
};

/** This returns a playlist where all ids are replaced with UIDs */
export async function k8sGetPlaylist(uid: string): Promise<Playlist> {
  const k8splaylist = await getBackendSrv().get<KubernetesPlaylist>(
    `/apis/playlist.x.grafana.com/v0alpha1/namespaces/org-${contextSrv.user.orgId}/playlists/${uid}`
  );
  const playlist = k8splaylist.spec;
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

export async function k8sGetAllPlaylist(): Promise<Playlist[]> {
  const k8splaylists = await getBackendSrv().get<KubernetesPlaylistList>(
    `/apis/playlist.x.grafana.com/v0alpha1/namespaces/org-${contextSrv.user.orgId}/playlists`
  );
  return k8splaylists.playlists.map((p) => p.spec);
}

/** This returns a playlist where all ids are replaced with UIDs */
export async function legacyGetPlaylist(uid: string): Promise<Playlist> {
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

export async function legacyGetAllPlaylist(): Promise<Playlist[]> {
  return getBackendSrv().get<Playlist[]>('/api/playlists/');
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

/** Returns a copy with the dashboards loaded */
export async function loadDashboards(items: PlaylistItem[]): Promise<PlaylistItem[]> {
  let idx = 0;
  if (!items?.length) {
    return [];
  }

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

  // The SQL based store can only execute individual queries
  if (!config.featureToggles.panelTitleSearch) {
    const searcher = getGrafanaSearcher();
    const res: PlaylistItem[] = [];
    for (let i = 0; i < targets.length; i++) {
      const view = (await searcher.search(targets[i].search!)).view;
      res.push({ ...items[i], dashboards: view.map((v) => ({ ...v })) });
    }
    return res;
  }

  // The bluge backend can execute multiple queries in a single request
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

export function getDefaultPlaylist(): Playlist {
  return { items: [], interval: '5m', name: '', uid: '' };
}

export function searchPlaylists(playlists: Playlist[], query?: string): Playlist[] {
  if (!query?.length) {
    return playlists;
  }
  query = query.toLowerCase();
  return playlists.filter((v) => v.name.toLowerCase().includes(query!));
}
