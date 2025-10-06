export interface PluginNode {
  id: string;
  name: string;
  type: 'app' | 'panel' | 'datasource';
  version?: string;
  description?: string;
  dependencies?: string[];
  x?: number;
  y?: number;
}

export interface PluginDependency {
  source: string; // plugin ID that provides content/functionality
  target: string; // plugin ID that consumes content/functionality
  type: 'extends' | 'depends' | 'integrates';
  description?: string;
}

export interface ExtensionPoint {
  id: string; // extension point ID (e.g., "grafana/alerting/home")
  definingPlugin: string; // plugin that defines this extension point
  providers: string[]; // apps that provide content to this extension point
  extensionType?: 'link' | 'component' | 'function'; // type of extension
  title?: string; // extension point title
  description?: string; // extension point description
}

export interface ExposedComponent {
  id: string; // exposed component ID (e.g., "grafana-asserts-app/entity-assertions-widget/v1")
  title: string; // component title
  description: string; // component description
  providingPlugin: string; // plugin that exposes this component
  consumers: string[]; // apps that depend on this exposed component
}

export interface Extension {
  id: string; // extension ID (e.g., "grafana-asserts-app/entity-assertions-widget/v1")
  title: string; // extension title
  description?: string; // extension description
  type: 'link' | 'component' | 'function'; // type of extension
  providingPlugin: string; // plugin that provides this extension
  targetExtensionPoint: string; // extension point this extension targets
}

export interface GraphData {
  nodes: PluginNode[];
  dependencies: PluginDependency[];
  extensionPoints: ExtensionPoint[];
  exposedComponents?: ExposedComponent[]; // For expose mode visualization
  extensions?: Extension[]; // For extension point mode visualization
}

export interface PanelOptions {
  // Visualization mode
  visualizationMode: 'add' | 'expose' | 'extensionpoint';

  // Visualization options
  showDependencyTypes: boolean;
  showDescriptions: boolean;

  // Layout options
  layoutType: 'hierarchical';

  // Filtering options
  selectedContentProviders: string[];
  selectedContentConsumers: string[];
  selectedExtensionPoints: string[];

  // Color options for extension types
  linkExtensionColor: string;
  componentExtensionColor: string;
  functionExtensionColor: string;
}

// Raw data interfaces for type safety
export interface RawPluginInfo {
  version?: string;
  description?: string;
  dependencies?: Record<string, unknown>; // Plugin dependencies
}

export interface RawExtensionLink {
  title?: string;
  description?: string;
  targets?: string[];
}

export interface RawExtensionComponent {
  title?: string;
  description?: string;
  targets?: string[];
}

export interface RawExtensionFunction {
  title?: string;
  description?: string;
  targets?: string[];
}

export interface RawPluginExtensions {
  addedLinks?: RawExtensionLink[];
  addedComponents?: RawExtensionComponent[];
  addedFunctions?: RawExtensionFunction[];
  extensionPoints?: Array<Record<string, unknown>>; // Extension points defined by the plugin
  exposedComponents?: Array<Record<string, unknown>>; // Exposed components
}

export interface RawPluginData {
  [pluginId: string]: RawPluginInfo & {
    extensions?: RawPluginExtensions;
  };
}
