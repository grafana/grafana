/**
 * Represents a plugin node in the dependency graph visualization.
 *
 * @public
 */
export interface PluginNode {
  /** Unique identifier for the plugin */
  id: string;
  /** Display name of the plugin */
  name: string;
  /** Type of plugin (app, panel, or datasource) */
  type: 'app' | 'panel' | 'datasource';
  /** Plugin version */
  version?: string;
  /** Plugin description */
  description?: string;
  /** List of plugin IDs this plugin depends on */
  dependencies?: string[];
  /** X coordinate for graph positioning */
  x?: number;
  /** Y coordinate for graph positioning */
  y?: number;
}

/**
 * Represents a dependency relationship between two plugins.
 *
 * @public
 */
export interface PluginDependency {
  /** Plugin ID that provides content/functionality */
  source: string;
  /** Plugin ID that consumes content/functionality */
  target: string;
  /** Type of dependency relationship */
  type: 'extends' | 'depends' | 'integrates';
  /** Description of the dependency relationship */
  description?: string;
}

/**
 * Represents an extension point that can be extended by other plugins.
 *
 * @public
 */
export interface ExtensionPoint {
  /** Extension point ID (e.g., "grafana/alerting/home") */
  id: string;
  /** Plugin that defines this extension point */
  definingPlugin: string;
  /** Apps that provide content to this extension point */
  providers: string[];
  /** Type of extension (link, component, or function) */
  extensionType?: 'link' | 'component' | 'function';
  /** Extension point title */
  title?: string;
  /** Extension point description */
  description?: string;
}

/**
 * Represents a component that is exposed by a plugin for use by other plugins.
 *
 * @public
 */
export interface ExposedComponent {
  /** Exposed component ID (e.g., "grafana-asserts-app/entity-assertions-widget/v1") */
  id: string;
  /** Component title */
  title: string;
  /** Component description */
  description: string;
  /** Plugin that exposes this component */
  providingPlugin: string;
  /** Apps that depend on this exposed component */
  consumers: string[];
}

/**
 * Represents an extension provided by a plugin that targets a specific extension point.
 *
 * @public
 */
export interface Extension {
  /** Extension ID (e.g., "grafana-asserts-app/entity-assertions-widget/v1") */
  id: string;
  /** Extension title */
  title: string;
  /** Extension description */
  description?: string;
  /** Type of extension (link, component, or function) */
  type: 'link' | 'component' | 'function';
  /** Plugin that provides this extension */
  providingPlugin: string;
  /** Extension point this extension targets */
  targetExtensionPoint: string;
}

/**
 * Complete graph data structure containing all nodes, dependencies, and extension information.
 *
 * @public
 */
export interface GraphData {
  /** All plugin nodes in the graph */
  nodes: PluginNode[];
  /** All dependency relationships between plugins */
  dependencies: PluginDependency[];
  /** All extension points in the graph */
  extensionPoints: ExtensionPoint[];
  /** Exposed components (for expose mode visualization) */
  exposedComponents?: ExposedComponent[];
  /** Extensions (for extension point mode visualization) */
  extensions?: Extension[];
}

/**
 * Configuration options for the Plugin Dependency Graph panel.
 *
 * @public
 */
export interface PanelOptions {
  /** Visualization mode determining what type of graph to display */
  visualizationMode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions';

  /** Whether to show dependency type labels on connections */
  showDependencyTypes: boolean;
  /** Whether to show descriptions in the graph */
  showDescriptions: boolean;

  /** Layout algorithm for positioning nodes */
  layoutType: 'hierarchical';

  /** Selected content provider plugins to display */
  selectedContentProviders: string[];
  /** Selected content consumer plugins to display */
  selectedContentConsumers: string[];
  /** Selected content consumers for extension point mode filtering */
  selectedContentConsumersForExtensionPoint: string[];
  /** Selected extension points to display */
  selectedExtensionPoints: string[];

  /** Color for link extension types */
  linkExtensionColor: string;
  /** Color for component extension types */
  componentExtensionColor: string;
  /** Color for function extension types */
  functionExtensionColor: string;
}

/**
 * Raw plugin information from data.json.
 *
 * @internal
 */
export interface RawPluginInfo {
  /** Plugin version */
  version?: string;
  /** Plugin description */
  description?: string;
  /** Plugin dependencies */
  dependencies?: Record<string, unknown>;
}

/**
 * Raw extension link data from data.json.
 *
 * @internal
 */
export interface RawExtensionLink {
  /** Link title */
  title?: string;
  /** Link description */
  description?: string;
  /** Target extension points */
  targets?: string[];
}

/**
 * Raw extension component data from data.json.
 *
 * @internal
 */
export interface RawExtensionComponent {
  /** Component title */
  title?: string;
  /** Component description */
  description?: string;
  /** Target extension points */
  targets?: string[];
}

/**
 * Raw extension function data from data.json.
 *
 * @internal
 */
export interface RawExtensionFunction {
  /** Function title */
  title?: string;
  /** Function description */
  description?: string;
  /** Target extension points */
  targets?: string[];
}

/**
 * Raw plugin extensions data from data.json.
 *
 * @internal
 */
export interface RawPluginExtensions {
  /** Added links */
  addedLinks?: RawExtensionLink[];
  /** Added components */
  addedComponents?: RawExtensionComponent[];
  /** Added functions */
  addedFunctions?: RawExtensionFunction[];
  /** Extension points defined by the plugin */
  extensionPoints?: Array<Record<string, unknown>>;
  /** Exposed components */
  exposedComponents?: Array<Record<string, unknown>>;
}

/**
 * Raw plugin data structure from data.json.
 *
 * @internal
 */
export interface RawPluginData {
  [pluginId: string]: RawPluginInfo & {
    extensions?: RawPluginExtensions;
  };
}
