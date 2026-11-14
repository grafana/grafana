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
  /** Translated plural name, as a title: "Dashboards". A function, so it translates at render and not at module load. */
  pluralLabel: () => string;
  icon: IconName;
  /**
   * Builds the path of the page for one object from its `metadata.name`, without the app sub path.
   * A `title` adds its slug where the page takes one. Absent when the kind has no page for a single
   * object.
   */
  getRoute?: (name: string, title?: string) => string;
  /** Path of the page that lists the kind's objects, without the app sub path. */
  listRoute: string;
}
