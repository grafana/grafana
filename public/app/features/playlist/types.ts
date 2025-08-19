import { PlaylistSpec } from '../../api/clients/playlist/v0alpha1';
import { DashboardQueryResult } from '../search/service/types';
export type PlaylistMode = boolean;

type PlaylistItem = PlaylistSpec['items'][number];

export interface PlaylistItemUI extends PlaylistItem {
  /**
   * Loaded at runtime by the frontend.
   *
   * The values are not stored in the backend database.
   */
  dashboards?: DashboardQueryResult[];
}
