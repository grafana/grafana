export const PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM = '_playlistViewToken';
export const PLAYLIST_CUSTOM_VIEW_MESSAGE = 'playlist-custom-view-selected';
const PLAYLIST_CUSTOM_VIEW_CHANNEL_PREFIX = 'grafana-playlist-custom-view';

export interface PlaylistCustomViewMessage {
  type: typeof PLAYLIST_CUSTOM_VIEW_MESSAGE;
  token: string;
  queryParams: string;
}

export function createPlaylistCustomViewToken(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function addPlaylistCustomViewToken(url: string, token: string): string {
  const fragmentStart = url.indexOf('#');
  const fragment = fragmentStart === -1 ? '' : url.slice(fragmentStart);
  const urlWithoutFragment = fragmentStart === -1 ? url : url.slice(0, fragmentStart);
  const queryStart = urlWithoutFragment.indexOf('?');
  const path = queryStart === -1 ? urlWithoutFragment : urlWithoutFragment.slice(0, queryStart);
  const query = queryStart === -1 ? '' : urlWithoutFragment.slice(queryStart + 1);
  const params = new URLSearchParams(query);
  params.set(PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM, token);

  return `${path}?${params.toString()}${fragment}`;
}

export function getPlaylistCustomViewChannelName(token: string): string {
  return `${PLAYLIST_CUSTOM_VIEW_CHANNEL_PREFIX}:${token}`;
}

export function getPlaylistCustomViewQueryParams(search: string): string {
  const queryParams = new URLSearchParams(search);
  queryParams.delete(PLAYLIST_CUSTOM_VIEW_TOKEN_PARAM);
  return queryParams.toString();
}

export function isPlaylistCustomViewMessage(value: unknown): value is PlaylistCustomViewMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'type' in value &&
    value.type === PLAYLIST_CUSTOM_VIEW_MESSAGE &&
    'token' in value &&
    typeof value.token === 'string' &&
    'queryParams' in value &&
    typeof value.queryParams === 'string'
  );
}
