import { type IconName } from '@grafana/data';

export interface LabelOptions {
  /** Uppercases the first letter and leaves the rest as translated, for a title or a table cell. */
  upperFirst?: boolean;
}

/**
 * How Grafana names, draws and links one kind of object. A feature that needs to know more about a
 * kind, such as how to list it, spreads the kind's row into an entry of its own.
 */
export interface KindInfo {
  /**
   * API group the kind is named by, e.g. `dashboard.grafana.app`. With `collectionGroup` no API
   * serves this group: it is the one the members' objects are stored under.
   */
  group: string;
  /**
   * Set when one API group per member serves the kind rather than `group` itself. Data sources are
   * the case: each plugin serves `{plugin}.datasource.grafana.app`. Such a kind covers every group
   * inside the collection.
   */
  collectionGroup?: true;
  /** Kubernetes kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name in API paths, e.g. `dashboards`. */
  resource: string;
  /** The kind string dashboard search rows carry. Absent when the kind is not in that index. */
  searchKind?: string;
  /**
   * Translated name as it reads mid-sentence: "dashboard". `upperFirst` gives the form a title shows.
   * Never lowercase a label: some languages, such as German, capitalize every noun. A function, so
   * it translates at render and not at module load.
   */
  getLabel: (options?: LabelOptions) => string;
  /** The plural of `getLabel`: "dashboards". */
  getPluralLabel: (options?: LabelOptions) => string;
  icon: IconName;
  /**
   * Builds the path of the page for one object from its `metadata.name`, without the app sub path.
   * Absent when the kind has no page for a single object.
   */
  getRoute?: (name: string) => string;
}
