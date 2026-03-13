import { Playlist } from '../../api/clients/playlist/v1';
import { contextSrv } from '../../core/services/context_srv';
import { AccessControlAction } from '../../types/accessControl';
import { getGrafanaSearcher } from '../search/service/searcher';
import { SearchQuery } from '../search/service/types';

import { PlaylistItemUI } from './types';

/**
 * Returns true if the current user can create, edit, or delete playlists.
 *
 * Uses playlists:read as a signal that the backend has registered playlist RBAC.
 * If the permission is absent (old backend not yet deployed), falls back to the
 * legacy isEditor check to avoid regressions during a mixed-version rollout.
 */
export function canWritePlaylists(): boolean {
  return contextSrv.hasPermission(AccessControlAction.PlaylistsRead)
    ? contextSrv.hasPermission(AccessControlAction.PlaylistsWrite)
    : contextSrv.isEditor;
}

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
  const results = await Promise.allSettled(targets.map((target) => searcher.search(target)));

  const res: PlaylistItemUI[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const dashboards = result.status === 'fulfilled' ? result.value.view.map((v) => ({ ...v })) : [];
    res.push({ ...items[i], dashboards });
  }

  return res;
}

export function getDefaultPlaylist(): Playlist {
  return {
    apiVersion: 'playlist.grafana.app/v1',
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
