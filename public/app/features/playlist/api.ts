import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, DataFrameView } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { dispatch } from 'app/store/store';

import { ScopedResourceClient } from '../apiserver/client';
import { Resource, ResourceForCreate, ResourceClient } from '../apiserver/types';
import { getGrafanaSearcher } from '../search/service/searcher';
import { DashboardQueryResult, SearchQuery } from '../search/service/types';

import { Playlist, PlaylistItem, PlaylistAPI } from './types';

class LegacyAPI implements PlaylistAPI {
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

interface PlaylistSpec {
  title: string;
  interval: string;
  items: PlaylistItem[];
}

type K8sPlaylist = Resource<PlaylistSpec>;

class K8sAPI implements PlaylistAPI {
  readonly server: ResourceClient<PlaylistSpec>;

  constructor() {
    this.server = new ScopedResourceClient<PlaylistSpec>({
      group: 'playlist.grafana.app',
      version: 'v0alpha1',
      resource: 'playlists',
    });
  }

  async getAllPlaylist(): Promise<Playlist[]> {
    const result = await this.server.list();
    return result.items.map(k8sResourceAsPlaylist);
  }

  async getPlaylist(uid: string): Promise<Playlist> {
    const r = await this.server.get(uid);
    const p = k8sResourceAsPlaylist(r);
    await migrateInternalIDs(p);
    return p;
  }

  async createPlaylist(playlist: Playlist): Promise<void> {
    const body = this.playlistAsK8sResource(playlist);
    await withErrorHandling(async () => {
      await this.server.create(body);
    });
  }

  async updatePlaylist(playlist: Playlist): Promise<void> {
    const body = this.playlistAsK8sResource(playlist);
    await withErrorHandling(() => this.server.update(body).then(() => {}));
  }

  async deletePlaylist(uid: string): Promise<void> {
    await withErrorHandling(() => this.server.delete(uid).then(() => {}), 'Playlist deleted');
  }

  playlistAsK8sResource = (playlist: Playlist): ResourceForCreate<PlaylistSpec> => {
    return {
      metadata: {
        name: playlist.uid, // uid as k8s name
      },
      spec: {
        title: playlist.name, // name becomes title
        interval: playlist.interval,
        items: playlist.items ?? [],
      },
    };
  };
}

// This converts a saved k8s resource into a playlist object
// the main difference is that k8s uses metadata.name as the uid
// to avoid future confusion, the display name is now called "title"
function k8sResourceAsPlaylist(r: K8sPlaylist): Playlist {
  const { spec, metadata } = r;
  return {
    uid: metadata.name, // use the k8s name as uid
    name: spec.title,
    interval: spec.interval,
    items: spec.items,
  };
}

/** @deprecated -- this migrates playlists saved with internal ids to uid  */
async function migrateInternalIDs(playlist: Playlist) {
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

export function getPlaylistAPI() {
  return config.featureToggles.kubernetesPlaylists ? new K8sAPI() : new LegacyAPI();
}
