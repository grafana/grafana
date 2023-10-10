import { DashboardQueryResult } from '../search/service';

import { PlaylistItem as PlaylistItemFromSchema } from './playlist_types.gen';

export type PlaylistMode = boolean | 'tv';

export interface PlayListItemDTO {
  id: number;
  title: string;
  type: 'dashboard' | 'tag';
}

export interface PlaylistAPI {
  getAllPlaylist(): Promise<Playlist[]>;
  getPlaylist(uid: string): Promise<Playlist>;
  createPlaylist(playlist: Playlist): Promise<void>;
  updatePlaylist(playlist: Playlist): Promise<void>;
  deletePlaylist(uid: string): Promise<void>;
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
