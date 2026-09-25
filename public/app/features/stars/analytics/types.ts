import { type EventProperty } from '@grafana/runtime/unstable';

export interface ItemStarred extends EventProperty {
  /** API group of the (un)starred resource, e.g. 'dashboard.grafana.app' or 'folder.grafana.app'. */
  group: string;
  /** Resource kind, e.g. 'Dashboard' or 'Folder'. Filter kind='Folder' for star-folders usage. */
  kind: string;
  /** Whether the action starred or unstarred the item. */
  status: 'starred' | 'unstarred';
  /** UI surface that triggered the toggle, e.g. 'StarToolbarButton'. */
  origin: string;
}
