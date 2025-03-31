import { Playlist } from '../../api/clients/playlist';
import { DashboardQueryResult } from '../search/service/types';
export type PlaylistMode = boolean;

export interface PlaylistUI {
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
  items?: Playlist['spec']['items'];
}

type PlaylistItem = Playlist['spec']['items'][number];

export interface PlaylistItemUI extends PlaylistItem {
  /**
   * Loaded at runtime by the frontend.
   *
   * The values are not stored in the backend database.
   */
  dashboards?: DashboardQueryResult[];
}
