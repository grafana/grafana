import { type IconName } from '@grafana/data';

/**
 * How Grafana names, draws and links one kind of object. A feature that needs to know more about a
 * kind, such as how to list or search it, extends this rather than keeping a table of its own.
 */
export interface KindInfo {
  /** API group, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name in API paths, e.g. `dashboards`. */
  resource: string;
  /** The kind string the dashboard search index labels its rows with; absent for kinds it does not hold. */
  searchKind?: string;
  /** Translated plural name, as a title: "Dashboards". A function, so it translates at render and not at module load. */
  pluralLabel: () => string;
  icon: IconName;
  /**
   * Path of the page for one object, with `{name}` standing for its `metadata.name` and without the
   * app sub path. Absent when the kind has no page for a single object.
   */
  url?: string;
  /** Whether that page's path also takes a slug of the object's title: `/d/{name}/{slug}`. */
  titleSlug?: boolean;
  /** Path of the page that lists the kind's objects, without the app sub path. */
  listUrl?: string;
}
