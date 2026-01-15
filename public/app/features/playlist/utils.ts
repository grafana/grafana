import { Playlist } from '../../api/clients/playlist/v0alpha1';
import { getGrafanaSearcher } from '../search/service/searcher';
import { SearchQuery } from '../search/service/types';

import { PlaylistItemUI } from './types';

/** Returns a copy with the dashboards loaded */
export async function loadDashboards(items: PlaylistItemUI[]): Promise<PlaylistItemUI[]> {
  if (!items?.length) {
    return [];
  }

  const targets: SearchQuery[] = [];
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
    targets.push(query);
  }

  const searcher = getGrafanaSearcher();
  const res: PlaylistItemUI[] = [];
  for (let i = 0; i < targets.length; i++) {
    const view = (await searcher.search(targets[i])).view;
    res.push({ ...items[i], dashboards: view.map((v) => ({ ...v })) });
  }
  return res;
}

export function getDefaultPlaylist(): Playlist {
  return {
    apiVersion: 'playlist.grafana.app/v0alpha1',
    kind: 'Playlist',
    spec: {
      items: [],
      interval: '5m',
      title: '',
    },
    metadata: {
      name: '',
    },
    status: {},
  };
}

export function searchPlaylists(playlists: Playlist[], query?: string): Playlist[] {
  if (!query?.length) {
    return playlists;
  }
  query = query.toLowerCase();
  return playlists.filter((v) => v.spec?.title.toLowerCase().includes(query!));
}
