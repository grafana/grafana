import { rangeUtil } from '@grafana/data';
import { useFlagPlaylistsRBAC } from '@grafana/runtime/internal';
import { AccessControlAction } from 'app/types/accessControl';

import { type Playlist } from '../../api/clients/playlist/v1';
import { contextSrv } from '../../core/services/context_srv';
import { getGrafanaSearcher } from '../search/service/searcher';
import { type SearchQuery } from '../search/service/types';

import { type PlaylistItemUI } from './types';

// `rangeUtil.intervalToMs` only anchors the start, so alone it accepts "30ssdd" and truncates "1.5m".
const INTERVAL_PATTERN = /^\d+(ms|[smhdwMy])?$/;

/** Whether an interval string (e.g. "5m", "30s") is well formed and a positive duration. */
export function isValidInterval(interval: string): boolean {
  if (!INTERVAL_PATTERN.test(interval)) {
    return false;
  }
  try {
    const ms = rangeUtil.intervalToMs(interval);
    return Number.isFinite(ms) && ms > 0;
  } catch {
    return false;
  }
}

export function useCanWritePlaylists(): boolean {
  const enabled = useFlagPlaylistsRBAC();
  return enabled ? contextSrv.hasPermission(AccessControlAction.PlaylistsWrite) : contextSrv.isEditor;
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
