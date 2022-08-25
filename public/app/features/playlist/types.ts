import { DashboardQueryResult } from "../search/service";

export interface PlaylistDTO {
  id: number;
  name: string;
  startUrl?: string;
  uid: string;
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
  uid: string;
}

export interface PlaylistItem {
  id?: number;
  value: string; // tag or uid
  type: 'dashboard_by_tag' | 'dashboard_by_uid' | 'dashboard_by_id'; // _by_id is deprecated
  order: number;
  title: string;
  playlistId?: number;
}

export interface PlaylistItemsWithDashboards extends PlaylistItem {
  dashboards: DashboardQueryResult[],
}
