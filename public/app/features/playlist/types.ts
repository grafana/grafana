import { DashboardQueryResult } from '../search/service';

export type PlaylistMode = boolean | 'tv';

export interface PlayListItemDTO {
  id: number;
  title: string;
  playlistid: string;
  type: 'dashboard' | 'tag';
}

export interface Playlist {
  uid: string;
  name: string;
  interval: string;
  items?: PlaylistItem[];
}

export interface PlaylistItem {
  type: 'dashboard_by_tag' | 'dashboard_by_uid' | 'dashboard_by_id'; // _by_id is deprecated
  value: string; // tag or uid

  // Loaded in the frontend
  dashboards?: DashboardQueryResult[];
}
