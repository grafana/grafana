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
  readonly group: string;
  /**
   * Set when no API serves `group` itself and each member serves a group inside it, such as
   * `{plugin}.datasource.grafana.app` for data sources.
   */
  readonly collectionGroup?: true;
  /** Kubernetes kind, e.g. `Dashboard`. */
  readonly kind: string;
  /** Plural resource name in API paths, e.g. `dashboards`. */
  readonly resource: string;
  /** Whether objects of this kind live in folders, carrying the folder annotation. */
  readonly folderScoped: boolean;
  /**
   * Translated name: "Dashboard", or "dashboard" as it reads inside a sentence with `upperFirst: false`.
   * Ask for the form you need instead of changing the case of a label.
   */
  readonly getLabel: (options?: KindLabelOptions) => string;
  /** The plural of `getLabel`: "Dashboards". */
  readonly getPluralLabel: (options?: KindLabelOptions) => string;
  readonly icon: IconName;
  /**
   * Name of the visualization palette color for the kind's icon, e.g. `semi-dark-orange`.
   * `theme.visualization.getColorByName` resolves it. Absent when the kind has no color of its own.
   */
  readonly iconColor?: ThemeVizHue['shades'][number]['name'];
  /**
   * Builds the path of the page for one object from its `metadata.name`, without the app sub path.
   * Absent when the kind has no page for a single object.
   */
  readonly getRoute?: (name: string) => string;
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
  readonly coreKinds: Readonly<Record<CoreKindKey, KindInfo>>;
  /**
   * Whether `group` names this kind: its own group, or for a collection kind a group served inside
   * the collection, which is the group a single object carries.
   */
  readonly coversGroup: (kind: KindInfo, group: string) => boolean;
  /** The kind an object of this API group and Kubernetes kind belongs to, among core and app kinds. */
  readonly findKind: (group: string, kind: string) => KindInfo | undefined;
  /** The kinds that app plugins add. A kind that Grafana serves itself is never among them. */
  readonly getAppKinds: () => KindInfo[];
  /** Adds the kinds an app plugin serves. A kind that Grafana serves itself keeps its core row. */
  readonly addKinds: (kinds: KindInfo[]) => void;
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
 * Used to retrieve the {@link KindRegistry}. Throws until Grafana has set it at startup.
 */
export function getKindRegistry(): KindRegistry {
  if (!singletonInstance) {
    throw new Error('KindRegistry is not set. Grafana sets it at startup; plugin tests mock getKindRegistry.');
  }
  return singletonInstance;
}
