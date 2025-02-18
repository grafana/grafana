import { DashboardQueryResult } from '../search/service/types';

export type PlaylistMode = boolean | 'tv';

export interface PlaylistAPI {
  getAllPlaylist(): Promise<Playlist[]>;
  getPlaylist(uid: string): Promise<Playlist>;
  createPlaylist(playlist: Playlist): Promise<void>;
  updatePlaylist(playlist: Playlist): Promise<void>;
  deletePlaylist(uid: string): Promise<void>;
}

export interface Playlist {
  /**
   * Unique playlist identifier. Generated on creation, either by the
   * creator of the playlist of by the application.
   */
  uid: string;

  /**
   * Name of the playlist.
   */
  name: string;

  /**
   * Interval sets the time between switching views in a playlist.
   */
  interval: string;

  /**
   * The ordered list of items that the playlist will iterate over.
   */
  items?: PlaylistItem[];
}

export interface PlaylistItem {
  /**
   * Type of the item.
   */
  type: // Use an explicit dashboard
  | 'dashboard_by_uid'
    // find all dashboards with a given tag
    | 'dashboard_by_tag'
    // @deprecated use a dashboard with a given internal id
    | 'dashboard_by_id';

  /**
   * Value depends on type and describes the playlist item.
   *
   *  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
   *  is not portable as the numerical identifier is non-deterministic between different instances.
   *  Will be replaced by dashboard_by_uid in the future. (deprecated)
   *  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
   *  dashboards behind the tag will be added to the playlist.
   *  - dashboard_by_uid: The value is the dashboard UID
   */
  value: string;

  /**
   * Loaded at runtime by the frontend.
   *
   * The values are not stored in the backend database.
   */
  dashboards?: DashboardQueryResult[];
}
