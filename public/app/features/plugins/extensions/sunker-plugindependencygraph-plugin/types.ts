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

export interface GraphData {
  nodes: PluginNode[];
  dependencies: PluginDependency[];
  extensionPoints: ExtensionPoint[];
  exposedComponents?: ExposedComponent[]; // For expose mode visualization
}

export interface PanelOptions {
  // Visualization mode
  visualizationMode: 'add' | 'expose';

  // Visualization options
  showDependencyTypes: boolean;
  showDescriptions: boolean;

  // Layout options
  layoutType: 'hierarchical';

  // Filtering options
  selectedContentProviders: string[];
  selectedContentConsumers: string[];

  // Color options for extension types
  linkExtensionColor: string;
  componentExtensionColor: string;
  functionExtensionColor: string;
}
