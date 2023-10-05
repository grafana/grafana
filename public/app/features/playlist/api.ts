import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, DataFrameView } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/services/context_srv';
import store from 'app/core/store';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { dispatch } from 'app/store/store';

import { DashboardQueryResult, getGrafanaSearcher, SearchQuery } from '../search/service';

import { Playlist, PlaylistItem, PlaylistAPI } from './types';

class LegacyAPI implements PlaylistAPI {
  isK8s() {
    return false;
  }

  async getAllPlaylist(): Promise<Playlist[]> {
    return getBackendSrv().get<Playlist[]>('/api/playlists/');
  }

  async getPlaylist(uid: string): Promise<Playlist> {
    const p = await getBackendSrv().get<Playlist>(`/api/playlists/${uid}`);
    await migrateInternalIDs(p);
    return p;
  }

  async createPlaylist(playlist: Playlist): Promise<void> {
    await withErrorHandling(() => getBackendSrv().post('/api/playlists', playlist));
  }

  async updatePlaylist(playlist: Playlist): Promise<void> {
    await withErrorHandling(() => getBackendSrv().put(`/api/playlists/${playlist.uid}`, playlist));
  }

  async deletePlaylist(uid: string): Promise<void> {
    await withErrorHandling(() => getBackendSrv().delete(`/api/playlists/${uid}`), 'Playlist deleted');
  }
}

interface KubernetesPlaylistList {
  playlists: KubernetesPlaylist[];
}

interface KubernetesPlaylist {
  spec: Playlist;
}

class K8sAPI implements PlaylistAPI {
  readonly url = `/apis/playlists.grafana.com/v0alpha1/namespaces/org-${contextSrv.user.orgId}/playlists`;

  isK8s() {
    return true;
  }

  constructor() {
    console.log('ROOT', this.url);
  }

  async getAllPlaylist(): Promise<Playlist[]> {
    console.log('getAllPlaylist', this.url);
    const result = await getBackendSrv().get<KubernetesPlaylistList>(this.url);
    console.log('got', result);
    return result.playlists.map((p) => p.spec);
  }

  async getPlaylist(uid: string): Promise<Playlist> {
    const p = await getBackendSrv().get<KubernetesPlaylist>(this.url + '/' + uid);
    await migrateInternalIDs(p.spec);
    return p.spec;
  }

  async createPlaylist(playlist: Playlist): Promise<void> {
    await withErrorHandling(() =>
      getBackendSrv().post(this.url, {
        apiVersion: 'playlists.grafana.com/v0alpha1',
        kind: 'Playlist',
        metadata: {
          name: playlist.uid,
        },
        spec: playlist,
      })
    );
  }

  async updatePlaylist(playlist: Playlist): Promise<void> {
    await withErrorHandling(() =>
      getBackendSrv().put(`${this.url}/${playlist.uid}`, {
        apiVersion: 'playlists.grafana.com/v0alpha1',
        kind: 'Playlist',
        metadata: {
          name: playlist.uid,
        },
        spec: playlist,
      })
    );
  }

  async deletePlaylist(uid: string): Promise<void> {
    await withErrorHandling(() => getBackendSrv().delete(`${this.url}/${uid}`), 'Playlist deleted');
  }
}

async function migrateInternalIDs(playlist: Playlist) {
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

export function setUseK8sAPI(v: boolean) {
  const current = store.getBool('playlists-test-k8s', Boolean(config.featureToggles.kubernetesPlaylists));
  if (current !== v) {
    store.set('playlists-test-k8s', v);
    location.reload();
  }
}

export function getPlaylistAPI() {
  return store.getBool('playlists-test-k8s', Boolean(config.featureToggles.kubernetesPlaylists))
    ? new K8sAPI()
    : new LegacyAPI();
}
