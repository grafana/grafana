import { lastValueFrom } from 'rxjs';

import { DataQueryRequest, DataFrameView } from '@grafana/data';
import { getBackendSrv, config } from '@grafana/runtime';
import { notifyApp } from 'app/core/actions';
import { createErrorNotification, createSuccessNotification } from 'app/core/copy/appNotification';
import { getGrafanaDatasource } from 'app/plugins/datasource/grafana/datasource';
import { GrafanaQuery, GrafanaQueryType } from 'app/plugins/datasource/grafana/types';
import { dispatch } from 'app/store/store';

import { Playlist } from '../../api/clients/playlist';
import { getGrafanaSearcher } from '../search/service/searcher';
import { DashboardQueryResult, SearchQuery } from '../search/service/types';

import { PlaylistUI, PlaylistItemUI } from './types';

export const playlistAsK8sResource = (playlist: PlaylistUI): Playlist => {
  return {
    metadata: {
      name: playlist.uid, // uid as k8s name
    },
    spec: {
      title: playlist.name, // name becomes title
      interval: playlist.interval,
      items: playlist.items ?? [],
    },
    status: {},
  };
};

// This converts a saved k8s resource into a playlist object
// the main difference is that k8s uses metadata.name as the uid
// to avoid future confusion, the display name is now called "title"
export function k8sResourceAsPlaylist(r: Playlist): PlaylistUI {
  const { spec, metadata } = r;
  return {
    uid: metadata.name ?? '', // use the k8s name as uid
    name: spec.title,
    interval: spec.interval,
    items: spec.items,
  };
}

// TODO figure out where we need to use this
/** @deprecated -- this migrates playlists saved with internal ids to uid  */
async function migrateInternalIDs(playlist: PlaylistUI) {
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

// TODO figure out where we need to use this
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
export async function loadDashboards(items: PlaylistItemUI[]): Promise<PlaylistItemUI[]> {
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
    const res: PlaylistItemUI[] = [];
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

export function getDefaultPlaylist(): PlaylistUI {
  return { items: [], interval: '5m', name: '', uid: '' };
}

export function searchPlaylists(playlists: PlaylistUI[], query?: string): PlaylistUI[] {
  if (!query?.length) {
    return playlists;
  }
  query = query.toLowerCase();
  return playlists.filter((v) => v.name.toLowerCase().includes(query!));
}
