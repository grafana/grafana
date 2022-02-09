export interface PlaylistDTO {
  id: number;
  name: string;
  startUrl?: string;
}

export type PlaylistMode = boolean | 'tv';

export interface PlayListItemDTO {
  id: number;
  title: string;
  playlistid: string;
  type: 'dashboard' | 'tag';
}

export interface Playlist {
  name: string;
  interval: string;
  items?: PlaylistItem[];
}

export interface PlaylistItem {
  id?: number;
  value: string; //tag or id.toString()
  type: 'dashboard_by_id' | 'dashboard_by_tag';
  order: number;
  title: string;
  playlistId?: number;
}
