import { rangeUtil } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AccessControlAction } from 'app/types/accessControl';

import { type Playlist } from '../../api/clients/playlist/v1';
import { contextSrv } from '../../core/services/context_srv';
import { getGrafanaSearcher } from '../search/service/searcher';
import { type SearchQuery } from '../search/service/types';

import { PLAYLIST_CUSTOM_VIEW_TITLE_PARAM, PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM } from './customView';
import { type PlaylistItemUI } from './types';

// Playlist/session controls belong to the playback URL, not a portable dashboard view.
export const PLAYLIST_RUNTIME_QUERY_PARAMS: ReadonlySet<string> = new Set([
  'kiosk',
  'autofitpanels',
  'orgId',
  'auth_token',
  'forceLogin',
  'hideLogo',
  '_dash.hideTimePicker',
  '_dash.hideVariables',
  '_dash.hideLinks',
  '_dash.hidePlaylistNav',
]);

/**
 * Whether an interval string (e.g. "5m", "30s") can be parsed to a positive duration.
 * `rangeUtil.intervalToMs` throws on unparseable input, so callers must guard against it.
 */
export function isValidInterval(interval: string): boolean {
  try {
    const ms = rangeUtil.intervalToMs(interval);
    return Number.isFinite(ms) && ms > 0;
  } catch {
    return false;
  }
}

export function normalizeDashboardViewQueryString(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const queryStart = trimmed.indexOf('?');
  const looksLikeDashboardUrl = /^(?:[a-z][a-z\d+.-]*:\/\/|\/)/i.test(trimmed);
  if (queryStart === -1 && looksLikeDashboardUrl) {
    return undefined;
  }

  const query = queryStart === -1 ? trimmed : trimmed.slice(queryStart + 1);
  const fragmentStart = query.indexOf('#');
  const normalized = (fragmentStart === -1 ? query : query.slice(0, fragmentStart)).replace(/^\?/, '');
  const params = new URLSearchParams(normalized);
  params.delete(PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM);
  params.delete(PLAYLIST_CUSTOM_VIEW_TITLE_PARAM);
  for (const key of PLAYLIST_RUNTIME_QUERY_PARAMS) {
    params.delete(key);
  }
  const serialized = params.toString();

  return serialized || undefined;
}

export function getPlaylistShortLinkUid(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const pathname = new URL(trimmed, 'http://grafana.local').pathname;
    const match = pathname.match(/(?:^|\/)goto\/([^/]+)\/?$/);
    return match?.[1] ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export function canWritePlaylists(): boolean {
  return config.featureToggles.playlistsRBAC
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
