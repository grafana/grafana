import { type IconName } from '@grafana/data';

/**
 * How Grafana names, draws and links one kind of object. A feature that needs to know more about a
 * kind, such as how to list or search it, spreads the kind's row into an entry of its own.
 */
export interface KindInfo {
  /** API group that serves the kind, e.g. `dashboard.grafana.app`. */
  group: string;
  /** Kubernetes kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name in API paths, e.g. `dashboards`. */
  resource: string;
  /**
   * Translated name as it reads mid-sentence: "dashboard", or "dashboards" with `plural`. A title
   * capitalizes it with `upperFirst`, never the other way round: some languages, such as German,
   * capitalize every noun. A function, so it translates at render and not at module load.
   */
  getLabel: (options?: { plural?: boolean }) => string;
  icon: IconName;
  /**
   * Builds the path of the page for one object from its `metadata.name`, without the app sub path.
   * Absent when the kind has no page for a single object.
   */
  getRoute?: (name: string) => string;
  /** Path of the page that lists the kind's objects, without the app sub path. */
  listRoute: string;
}

/**
 * A kind that no API group of its own serves: each member of `collection` serves it under
 * `{member}.{collection}`. Data sources are the case, with one group per plugin.
 */
export interface CollectionKindInfo extends Omit<KindInfo, 'group'> {
  /** What the groups serving the kind end in, e.g. `datasource.grafana.app`. Not a served group itself. */
  collection: string;
}
