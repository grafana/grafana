import { DashboardQueryResult } from '../search/service';

export type PlaylistMode = boolean | 'tv';

export interface Playlist {
  uid: string;
  name: string;
  interval: string;
  items?: PlaylistItem[];
}

// TODO: use Playlist+Playlist item from `@grafana/schema`... but add the dashboards inline
export interface PlaylistItem {
  type: 'dashboard_by_tag' | 'dashboard_by_uid' | 'dashboard_by_id'; // _by_id is deprecated
  value: string; // tag or uid

  // Loaded in the frontend
  dashboards?: DashboardQueryResult[];
}
