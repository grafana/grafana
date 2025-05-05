import { Playlist } from '../../api/clients/playlist';
import { DashboardQueryResult } from '../search/service/types';
export type PlaylistMode = boolean;

type PlaylistItem = Playlist['spec']['items'][number];

export interface PlaylistItemUI extends PlaylistItem {
  /**
   * Loaded at runtime by the frontend.
   *
   * The values are not stored in the backend database.
   */
  dashboards?: DashboardQueryResult[];
}
