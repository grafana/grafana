import { type EventProperty } from '@grafana/runtime/unstable';

export interface ItemStarred extends EventProperty {
  /** API group of the (un)starred resource, e.g. 'dashboard.grafana.app', 'folder.grafana.app' or the group of an app plugin. */
  group: string;
  /** Resource kind, e.g. 'Dashboard' or 'Folder'. Filter kind='Folder' for star-folders usage. */
  kind: string;
  /** Whether the action starred or unstarred the item. */
  status: 'starred' | 'unstarred';
  /** What made the toggle: 'StarToolbarButton' for Grafana's star button, 'StarsSrv' for a plugin through the stars service. */
  origin: string;
}
