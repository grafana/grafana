import { PlaylistItem as PlaylistItemFromSchema } from '@grafana/schema';

import { DashboardQueryResult } from '../search/service';

export type PlaylistMode = boolean | 'tv';

export interface PlayListItemDTO {
  id: number;
  title: string;
  playlistid: string;
  type: 'dashboard' | 'tag';
}

export interface PlaylistAPI {
  getPlaylist(uid: string): Promise<Playlist>;
  getAllPlaylist(): Promise<Playlist[]>;
}

export interface KubernetesPlaylistList {
  playlists: KubernetesPlaylist[];
}

export interface KubernetesPlaylist {
  spec: Playlist;
}

export interface Playlist {
  uid: string;
  name: string;
  interval: string;
  items?: PlaylistItem[];
}

export interface PlaylistItem extends PlaylistItemFromSchema {
  // Loaded in the frontend
  dashboards?: DashboardQueryResult[];
}
