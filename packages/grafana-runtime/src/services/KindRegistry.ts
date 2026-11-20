import { type IconName, type ThemeVizHue } from '@grafana/data';

export interface KindLabelOptions {
  /**
   * Uppercases the first letter, as a title or a table cell shows the label. On by default; `false`
   * gives the label as it reads inside a sentence.
   */
  upperFirst?: boolean;
}

/** How Grafana names, draws and links one kind of object. */
export interface KindInfo {
  /** API group the kind is named by, e.g. `dashboard.grafana.app`. */
  group: string;
  /**
   * Set when no API serves `group` itself and each member serves a group inside it, such as
   * `{plugin}.datasource.grafana.app` for data sources.
   */
  collectionGroup?: true;
  /** Kubernetes kind, e.g. `Dashboard`. */
  kind: string;
  /** Plural resource name in API paths, e.g. `dashboards`. */
  resource: string;
  /** The kind string dashboard search rows carry. Absent when the kind is not in that index. */
  searchKind?: string;
  /** Whether objects of this kind live in folders. */
  folderScoped: boolean;
  /**
   * Translated name: "Dashboard", or "dashboard" as it reads inside a sentence with `upperFirst: false`.
   * Ask for the form you need instead of changing the case of a label.
   */
  getLabel: (options?: KindLabelOptions) => string;
  /** The plural of `getLabel`: "Dashboards". */
  getPluralLabel: (options?: KindLabelOptions) => string;
  icon: IconName;
  /**
   * Name of the visualization palette color for the kind's icon, e.g. `semi-dark-orange`.
   * `theme.visualization.getColorByName` resolves it. Absent when the kind has no color of its own.
   */
  iconColor?: ThemeVizHue['shades'][number]['name'];
  /**
   * Builds the path of the page for one object from its `metadata.name`, without the app sub path.
   * Absent when the kind has no page for a single object.
   */
  getRoute?: (name: string) => string;
}

/** The key each of Grafana's own kinds has in {@link KindRegistry.coreKinds}. */
export type CoreKindKey =
  | 'folder'
  | 'dashboard'
  | 'notebook'
  | 'playlist'
  | 'librarypanel'
  | 'repository'
  | 'connection'
  | 'datasource';

/**
 * Grafana's description of the kinds it serves itself, with the lookups over it. A plugin reads it
 * through {@link getKindRegistry} to name, draw and link such a kind the way Grafana does.
 */
export interface KindRegistry {
  /** One row for each kind Grafana serves itself. */
  coreKinds: Readonly<Record<CoreKindKey, KindInfo>>;
  /**
   * Whether `group` names this kind: its own group, or for a collection kind a group served inside
   * the collection, which is the group a single object carries.
   */
  coversGroup: (kind: KindInfo, group: string) => boolean;
  /** The kind an object of this API group and Kubernetes kind belongs to. */
  findKind: (group: string, kind: string) => KindInfo | undefined;
  /** The kind behind a dashboard search row's kind string; undefined for rows such as panels. */
  findKindBySearchKind: (searchKind: string) => KindInfo | undefined;
}

let singletonInstance: KindRegistry | undefined;

/**
 * Used during startup by Grafana to set the KindRegistry so it is available
 * via {@link getKindRegistry} to the rest of the application.
 *
 * @internal
 */
export function setKindRegistry(instance: KindRegistry) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link KindRegistry}.
 */
export function getKindRegistry(): KindRegistry {
  if (!singletonInstance) {
    throw new Error('KindRegistry not set. Use setKindRegistry to set it first.');
  }
  return singletonInstance;
}
