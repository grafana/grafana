import { AppPluginConfig, PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';

import pluginDataFallback from '../data.json';
import { ExposedComponent, ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../types';

// Cache for expensive calculations
const cache = new Map<string, GraphData>();
const ENABLE_DEBUG_LOGS = false; // Set to true for debugging

/**
 * Gets plugin data from window.grafanaBootData.settings.apps with fallback to data.json
 *
 * @returns Plugin data object
 */
const getPluginData = (): Record<string, AppPluginConfig> => {
  // Try to get data from window.grafanaBootData.settings.apps first
  if (typeof window !== 'undefined' && window.grafanaBootData?.settings?.apps) {
    if (ENABLE_DEBUG_LOGS) {
      console.log(
        'Using data from window.grafanaBootData.settings.apps',
        Object.keys(window.grafanaBootData.settings.apps).length,
        'plugins'
      );
    }
    return window.grafanaBootData.settings.apps;
  }

  // Fallback to data.json
  if (ENABLE_DEBUG_LOGS) {
    console.log('Falling back to data.json', Object.keys(pluginDataFallback).length, 'plugins');
    console.log('window.grafanaBootData available:', typeof window !== 'undefined' && !!window.grafanaBootData);
    console.log(
      'window.grafanaBootData.settings available:',
      typeof window !== 'undefined' && !!window.grafanaBootData?.settings
    );
    console.log(
      'window.grafanaBootData.settings.apps available:',
      typeof window !== 'undefined' && !!window.grafanaBootData?.settings?.apps
    );
  }
  return pluginDataFallback;
};

/**
 * Clears all cached graph data results.
 *
 * Call this when the underlying plugin data changes or when you want to force
 * a fresh computation of all graph data.
 */
export const clearCache = (): void => {
  cache.clear();
};

/**
 * Returns the current number of cached graph data results.
 *
 * @returns The number of entries currently in the cache
 */
export const getCacheSize = (): number => {
  return cache.size;
};

// Helper to generate cache keys
const getCacheKey = (options: PanelOptions): string => {
  return JSON.stringify({
    mode: options.visualizationMode,
    providers: options.selectedContentProviders?.slice().sort(), // slice to avoid mutating original
    consumers: options.selectedContentConsumers?.slice().sort(),
  });
};

/**
 * Processes plugin data from data.json into a graph format for visualization.
 *
 * This is the main entry point for data processing. It routes to the appropriate
 * processor based on the visualization mode and implements result caching for
 * performance optimization.
 *
 * @param options - Panel configuration options that determine visualization mode and filtering
 * @returns GraphData structure containing nodes, dependencies, and extension information
 *
 * @example
 * ```typescript
 * const options: PanelOptions = {
 *   visualizationMode: 'add',
 *   selectedContentProviders: [],
 *   selectedContentConsumers: []
 * };
 * const graphData = processPluginDataToGraph(options);
 * ```
 */
export const processPluginDataToGraph = (options: PanelOptions): GraphData => {
  // Check cache first
  const cacheKey = getCacheKey(options);
  if (cache.has(cacheKey)) {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - returning cached result for:', cacheKey);
    }
    return cache.get(cacheKey)!;
  }

  const pluginData = getPluginData();
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToGraph - processing plugin data:', Object.keys(pluginData).length, 'plugins');
  }

  // Route to the appropriate processor based on visualization mode
  let result: GraphData;
  if (options.visualizationMode === 'expose') {
    result = processPluginDataToExposeGraph(options, pluginData);
  } else {
    result = processPluginDataToAddGraph(options, pluginData);
  }

  // Cache the result
  cache.set(cacheKey, result);
  return result;
};

/**
 * Processes plugin data for "add" mode visualization.
 *
 * In add mode, the visualization shows:
 * - Content providers (left side): Plugins that add extensions to extension points
 * - Extension points (right side): Grouped by the plugin that defines them
 * - Dependencies: Show which providers add to which extension points
 *
 * @param options - Panel options containing filtering settings
 * @returns GraphData with nodes, dependencies, and extension points for add mode
 */
const processPluginDataToAddGraph = (options: PanelOptions, pluginData: Record<string, AppPluginConfig>): GraphData => {
  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Pre-compute plugin entries for better performance
  const pluginEntries = Object.entries(pluginData);

  // Process each plugin from data.json
  pluginEntries.forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider (has addedLinks, addedComponents, or addedFunctions)
    const isContentProvider =
      (extensions.addedLinks && extensions.addedLinks.length > 0) ||
      (extensions.addedComponents && extensions.addedComponents.length > 0) ||
      (extensions.addedFunctions && extensions.addedFunctions.length > 0);

    // Check if this plugin is a content consumer (has extensionPoints)
    const isContentConsumer = extensions.extensionPoints && extensions.extensionPoints.length > 0;

    // Add plugin node if it's either a provider or consumer
    if (isContentProvider || isContentConsumer) {
      if (!nodes.has(pluginId)) {
        nodes.set(pluginId, {
          id: pluginId,
          name: getDisplayName(pluginId),
          type: getPluginType(pluginId),
          version: pluginInfo.version,
          description:
            isContentProvider && isContentConsumer
              ? t('extensions.dependency-graph.provides-and-consumes', 'Provides and consumes extension content')
              : isContentProvider
                ? t('extensions.dependency-graph.provides-content', 'Provides content to extension points')
                : t('extensions.dependency-graph.defines-extension-points', 'Defines extension points'),
        });
      }
    }

    // Process extension points that this plugin defines
    if (isContentConsumer) {
      if (ENABLE_DEBUG_LOGS) {
        console.log(`Processing extension points for plugin ${pluginId}:`, extensions.extensionPoints);
      }
      extensions.extensionPoints.forEach((extensionPoint, index) => {
        if (ENABLE_DEBUG_LOGS) {
          console.log(`Extension point ${index} raw data:`, extensionPoint);
        }
        if (!extensionPoints.has(extensionPoint.id)) {
          const processedExtensionPoint = {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [],
            extensionType: 'link' as const, // Default type, could be enhanced later
            title: extensionPoint.title,
            description: extensionPoint.description,
          };
          if (ENABLE_DEBUG_LOGS) {
            console.log(`Processed extension point:`, processedExtensionPoint);
          }
          extensionPoints.set(extensionPoint.id, processedExtensionPoint);
        }
      });
    }

    // Process content that this plugin provides
    if (isContentProvider) {
      // Process addedLinks
      extensions.addedLinks?.forEach((link) => {
        link.targets?.forEach((target) => {
          // Create dependency from this plugin to the target extension point
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides link to ${target}`,
          });

          // Find the defining plugin for this target extension point
          const extensionDetails = findExtensionPointDetails(target, pluginData);
          if (extensionDetails.definingPlugin && !extensionPoints.has(target)) {
            // Create extension point if it doesn't exist
            extensionPoints.set(target, {
              id: target,
              definingPlugin: extensionDetails.definingPlugin,
              providers: [],
              extensionType: 'link',
              title: extensionDetails.title,
              description: extensionDetails.description,
            });
          }

          // Add this plugin as a provider to the extension point
          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });

      // Process addedComponents
      extensions.addedComponents?.forEach((component) => {
        component.targets?.forEach((target) => {
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides component to ${target}`,
          });

          const extensionDetails = findExtensionPointDetails(target, pluginData);
          if (extensionDetails.definingPlugin && !extensionPoints.has(target)) {
            extensionPoints.set(target, {
              id: target,
              definingPlugin: extensionDetails.definingPlugin,
              providers: [],
              extensionType: 'component',
              title: extensionDetails.title,
              description: extensionDetails.description,
            });
          }

          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });

      // Process addedFunctions
      extensions.addedFunctions?.forEach((func) => {
        func.targets?.forEach((target) => {
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides function to ${target}`,
          });

          const extensionDetails = findExtensionPointDetails(target, pluginData);
          if (extensionDetails.definingPlugin && !extensionPoints.has(target)) {
            extensionPoints.set(target, {
              id: target,
              definingPlugin: extensionDetails.definingPlugin,
              providers: [],
              extensionType: 'function',
              title: extensionDetails.title,
              description: extensionDetails.description,
            });
          }

          const extensionPoint = extensionPoints.get(target);
          if (extensionPoint && !extensionPoint.providers.includes(pluginId)) {
            extensionPoint.providers.push(pluginId);
          }
        });
      });
    }
  });

  // Add defining plugin nodes for extension points
  extensionPoints.forEach((extensionPoint) => {
    if (!nodes.has(extensionPoint.definingPlugin)) {
      const definingPlugin = extensionPoint.definingPlugin;
      nodes.set(definingPlugin, {
        id: definingPlugin,
        name: getDisplayName(definingPlugin),
        type: getPluginType(definingPlugin),
        description: t('extensions.dependency-graph.defines-extension-points', 'Defines extension points'),
      });
    }
  });

  // Apply filtering logic similar to the original function
  let filteredDependencies = dependencies;
  let filteredExtensionPoints = Array.from(extensionPoints.values());
  let filteredNodes = Array.from(nodes.values());

  if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
    // Filter dependencies to only include selected content providers
    filteredDependencies = dependencies.filter((dep) => options.selectedContentProviders.includes(dep.source));

    // Update extension points to only include those that still have providers after filtering
    filteredExtensionPoints = filteredExtensionPoints
      .map((ep) => ({
        ...ep,
        providers: ep.providers.filter((provider) => options.selectedContentProviders.includes(provider)),
      }))
      .filter((ep) => ep.providers.length > 0);

    // Get set of defining plugins that still have extension points
    const activeDefiningPlugins = new Set(filteredExtensionPoints.map((ep) => ep.definingPlugin));

    // Get set of selected content providers
    const selectedProviders = new Set(options.selectedContentProviders);

    // Filter nodes to only include selected content providers and active defining plugins
    filteredNodes = filteredNodes.filter(
      (node) => selectedProviders.has(node.id) || activeDefiningPlugins.has(node.id)
    );
  }

  // Apply filtering based on selectedContentConsumers
  let consumersToShow: Set<string>;
  if (!options.selectedContentConsumers || options.selectedContentConsumers.length === 0) {
    // Default: show only consumers that have providers extending to them
    const activeConsumers = new Set<string>();
    filteredDependencies.forEach((dep) => {
      const extensionPoint = filteredExtensionPoints.find((ep) => ep.id === dep.target);
      if (extensionPoint) {
        activeConsumers.add(extensionPoint.definingPlugin);
      }
    });
    consumersToShow = activeConsumers;
  } else {
    consumersToShow = new Set(options.selectedContentConsumers);
  }

  // Filter extension points to only include those defined by selected consumers
  filteredExtensionPoints = filteredExtensionPoints.filter((ep) => consumersToShow.has(ep.definingPlugin));

  // Filter dependencies to only include those targeting remaining extension points
  const remainingExtensionPointIds = new Set(filteredExtensionPoints.map((ep) => ep.id));
  filteredDependencies = filteredDependencies.filter((dep) => remainingExtensionPointIds.has(dep.target));

  // Get set of content providers that still have valid dependencies
  const activeContentProviders = new Set(filteredDependencies.map((dep) => dep.source));

  // Filter nodes to only include selected consumers and active content providers
  filteredNodes = filteredNodes.filter((node) => consumersToShow.has(node.id) || activeContentProviders.has(node.id));

  const result = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToAddGraph - final result:', result);
    console.log('Final extension points count:', result.extensionPoints.length);
    result.extensionPoints.forEach((ep, index) => {
      console.log(`Final extension point ${index}:`, {
        id: ep.id,
        title: ep.title,
        description: ep.description,
        definingPlugin: ep.definingPlugin,
      });
    });
  }

  return result;
};

/**
 * Processes plugin data for "expose" mode visualization.
 *
 * In expose mode, the visualization shows:
 * - Content providers (left side): Plugins that expose components/APIs
 * - Exposed components (center): Components/APIs that are exposed
 * - Content consumers (right side): Plugins that consume the exposed components
 * - Dependencies: Show the flow from provider → component → consumer
 *
 * @param options - Panel options containing filtering settings
 * @returns GraphData with nodes, dependencies, and exposed components for expose mode
 */
export const processPluginDataToExposeGraph = (
  options: PanelOptions,
  pluginData: Record<string, AppPluginConfig>
): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExposeGraph - processing expose mode data');
  }

  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const exposedComponents: Map<string, ExposedComponent> = new Map();

  // First pass: collect all exposed components
  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin exposes any components
    if (extensions.exposedComponents && extensions.exposedComponents.length > 0) {
      extensions.exposedComponents.forEach((exposedComponent) => {
        if (exposedComponent.id && exposedComponent.id.trim() !== '') {
          exposedComponents.set(exposedComponent.id, {
            id: exposedComponent.id,
            title: exposedComponent.title || exposedComponent.id,
            description:
              exposedComponent.description || t('extensions.dependency-graph.exposed-component', 'Exposed component'),
            providingPlugin: pluginId,
            consumers: [],
          });

          // Add the providing plugin as a node
          if (!nodes.has(pluginId)) {
            nodes.set(pluginId, {
              id: pluginId,
              name: getDisplayName(pluginId),
              type: getPluginType(pluginId),
              version: pluginInfo.version,
              description: t('extensions.dependency-graph.exposes-components', 'Exposes components to other plugins'),
            });
          }
        }
      });
    }
  });

  // Second pass: collect dependencies on exposed components
  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginDependencies = pluginInfo.dependencies;

    // Check if this plugin depends on any exposed components
    if (
      pluginDependencies.extensions?.exposedComponents &&
      pluginDependencies.extensions.exposedComponents.length > 0
    ) {
      pluginDependencies.extensions.exposedComponents.forEach((exposedComponentId: string) => {
        if (exposedComponentId.trim() !== '') {
          const exposedComponent = exposedComponents.get(exposedComponentId);
          if (exposedComponent) {
            // Add this plugin as a consumer
            if (!exposedComponent.consumers.includes(pluginId)) {
              exposedComponent.consumers.push(pluginId);
            }

            // Create dependency - this represents the flow from provider through component to consumer
            dependencies.push({
              source: exposedComponent.providingPlugin, // Provider is the source
              target: pluginId, // Consumer is the target
              type: 'depends',
              description: `${getDisplayName(pluginId)} consumes ${exposedComponent.title} from ${getDisplayName(
                exposedComponent.providingPlugin
              )}`,
            });

            // Add the consuming plugin as a node
            if (!nodes.has(pluginId)) {
              nodes.set(pluginId, {
                id: pluginId,
                name: getDisplayName(pluginId),
                type: getPluginType(pluginId),
                version: pluginInfo.version,
                description: t(
                  'extensions.dependency-graph.consumes-components',
                  'Consumes exposed components from other plugins'
                ),
              });
            }
          }
        }
      });
    }
  });

  // Apply filtering logic
  let filteredDependencies = dependencies;
  let filteredExposedComponents = Array.from(exposedComponents.values());
  let filteredNodes = Array.from(nodes.values());

  // Filter by selected content providers (plugins that expose components)
  if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
    // Filter exposed components to only show those from selected providers
    filteredExposedComponents = filteredExposedComponents.filter((comp) =>
      options.selectedContentProviders.includes(comp.providingPlugin)
    );

    // Filter dependencies to only include those where the provider is in selected providers
    filteredDependencies = filteredDependencies.filter((dep) => {
      return options.selectedContentProviders.includes(dep.target);
    });
  }

  // Filter by selected content consumers (plugins that consume exposed components)
  if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
    filteredDependencies = filteredDependencies.filter((dep) => options.selectedContentConsumers.includes(dep.source));
    // Also filter exposed components to only show those consumed by selected consumers
    filteredExposedComponents = filteredExposedComponents.filter((comp) =>
      comp.consumers.some((consumer) => options.selectedContentConsumers.includes(consumer))
    );
  }

  // Get the set of active plugins based on filtered data
  const activeProviders = new Set(filteredExposedComponents.map((comp) => comp.providingPlugin));
  const activeConsumers = new Set(filteredDependencies.map((dep) => dep.source));

  if (ENABLE_DEBUG_LOGS) {
    console.log('[Expose Mode Debug]');
    console.log('Filtered exposed components:', filteredExposedComponents);
    console.log('Active providers:', activeProviders);
    console.log('Active consumers:', activeConsumers);
    console.log(
      'All nodes before filtering:',
      filteredNodes.map((n) => n.id)
    );
  }

  // ALWAYS include provider nodes if we have their exposed components
  // Show all relevant nodes: ALL selected providers + consumers that depend on them
  filteredNodes = filteredNodes.filter((node) => {
    const isProvider = activeProviders.has(node.id);
    const isConsumer = activeConsumers.has(node.id);

    // Always include providers that have exposed components shown
    if (isProvider) {
      return true;
    }

    // Include consumers that depend on the shown exposed components
    if (isConsumer) {
      return true;
    }

    return false;
  });

  if (ENABLE_DEBUG_LOGS) {
    console.log(
      'Final filtered nodes:',
      filteredNodes.map(
        (n) => `${n.id} (${activeProviders.has(n.id) ? 'provider' : ''}${activeConsumers.has(n.id) ? 'consumer' : ''})`
      )
    );
  }

  // Update consumers arrays in filtered exposed components to reflect actual filtered dependencies
  filteredExposedComponents = filteredExposedComponents.map((comp) => ({
    ...comp,
    consumers: comp.consumers.filter((consumerId) => activeConsumers.has(consumerId)),
  }));

  const result: GraphData = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: [], // Not used in expose mode
    exposedComponents: filteredExposedComponents,
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExposeGraph - final result:', result);
  }

  return result;
};

// Type definition for plugin data structure (improve type safety)
interface PluginInfo {
  version?: string;
  extensions: {
    extensionPoints?: Array<{
      id: string;
      title?: string;
      description?: string;
    }>;
    addedLinks?: Array<{ targets?: string[] }>;
    addedComponents?: Array<{ targets?: string[] }>;
    addedFunctions?: Array<{ targets?: string[] }>;
    exposedComponents?: Array<{
      id: string;
      title?: string;
      description?: string;
    }>;
  };
  dependencies: {
    extensions?: {
      exposedComponents?: string[];
    };
  };
}

// Helper function to find the defining plugin and extension point details for a target
const findExtensionPointDetails = (
  target: string,
  pluginData: Record<string, AppPluginConfig>
): { definingPlugin: string; title?: string; description?: string } => {
  // First check if any plugin explicitly defines this extension point
  for (const [pluginId, pluginInfo] of Object.entries(pluginData)) {
    const extensions = pluginInfo.extensions;
    const extensionPoint = extensions.extensionPoints?.find((ep) => ep.id === target);
    if (extensionPoint) {
      return {
        definingPlugin: pluginId,
        title: extensionPoint.title,
        description: extensionPoint.description,
      };
    }
  }

  // If not found, try to infer from the target ID format
  // Many extension points follow the pattern "pluginId/..." or "grafana/..."
  if (target.startsWith('grafana/')) {
    return { definingPlugin: 'grafana-core' };
  }

  // Try to match plugin ID from the beginning of the target
  const targetParts = target.split('/');
  if (targetParts.length > 0) {
    const potentialPluginId = targetParts[0];
    if (pluginData[potentialPluginId]) {
      return { definingPlugin: potentialPluginId };
    }

    // Try with -app suffix
    const potentialPluginIdWithApp = `${potentialPluginId}-app`;
    if (pluginData[potentialPluginIdWithApp]) {
      return { definingPlugin: potentialPluginIdWithApp };
    }
  }

  // Default fallback
  return { definingPlugin: 'grafana-core' };
};

// Memoized helper functions for better performance
const displayNameCache = new Map<string, string>();
const pluginTypeCache = new Map<string, PluginNode['type']>();

const getDisplayName = (pluginId: string): string => {
  if (displayNameCache.has(pluginId)) {
    return displayNameCache.get(pluginId)!;
  }

  let displayName: string;
  if (pluginId === 'grafana-core') {
    displayName = t('extensions.dependency-graph.grafana-core', 'Grafana Core');
  } else {
    displayName = pluginId
      .replace(/^grafana-/, '')
      .replace(/-app$/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  displayNameCache.set(pluginId, displayName);
  return displayName;
};

const getPluginType = (pluginId: string): PluginNode['type'] => {
  if (pluginTypeCache.has(pluginId)) {
    return pluginTypeCache.get(pluginId)!;
  }

  let type: PluginNode['type'];
  if (pluginId === 'grafana-core') {
    type = 'app';
  } else if (pluginId.includes('-panel')) {
    type = 'panel';
  } else if (pluginId.includes('-datasource')) {
    type = 'datasource';
  } else {
    type = 'app'; // Default to app
  }

  pluginTypeCache.set(pluginId, type);
  return type;
};

// Keep the original function for backward compatibility, but it now just calls the new one
export const processTableDataToGraph = (data: PanelData, options: PanelOptions): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processTableDataToGraph - redirecting to processPluginDataToGraph');
  }
  return processPluginDataToGraph(options);
};

// Memoization for expensive helper functions
const availableProvidersCache = new Map<string, string[]>();
const availableConsumersCache = new Map<string, string[]>();
const activeConsumersCache = new Map<string, string[]>();

/**
 * Gets all available content provider plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'add' (plugins that add extensions) or 'expose' (plugins that expose components)
 * @returns Sorted array of plugin IDs that act as content providers
 */
export const getAvailableContentProviders = (mode: 'add' | 'expose' = 'add'): string[] => {
  if (availableProvidersCache.has(mode)) {
    return availableProvidersCache.get(mode)!;
  }

  const contentProviders = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    if (mode === 'expose') {
      // In expose mode, content providers are plugins that expose components
      const exposesComponents =
        extensions.exposedComponents &&
        extensions.exposedComponents.length > 0 &&
        extensions.exposedComponents.some((comp) => comp && comp.id && comp.id.trim() !== '');

      if (exposesComponents) {
        contentProviders.add(pluginId);
      }
    } else {
      // In add mode, content providers are plugins that add extensions
      const isContentProvider =
        (extensions.addedLinks && extensions.addedLinks.length > 0) ||
        (extensions.addedComponents && extensions.addedComponents.length > 0) ||
        (extensions.addedFunctions && extensions.addedFunctions.length > 0);

      if (isContentProvider) {
        contentProviders.add(pluginId);
      }
    }
  });

  const result = Array.from(contentProviders).sort();
  availableProvidersCache.set(mode, result);
  return result;
};

/**
 * Gets all available content consumer plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'add' (plugins that define extension points) or 'expose' (plugins that consume exposed components)
 * @returns Sorted array of plugin IDs that act as content consumers
 */
export const getAvailableContentConsumers = (mode: 'add' | 'expose' = 'add'): string[] => {
  if (availableConsumersCache.has(mode)) {
    return availableConsumersCache.get(mode)!;
  }

  const contentConsumers = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    if (mode === 'expose') {
      // In expose mode, content consumers are plugins that depend on exposed components
      const pluginDependencies = pluginInfo.dependencies;
      const dependsOnExposedComponents =
        pluginDependencies.extensions?.exposedComponents && pluginDependencies.extensions.exposedComponents.length > 0;

      if (dependsOnExposedComponents) {
        contentConsumers.add(pluginId);
      }
    } else {
      // In add mode, content consumers are plugins that define extension points
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        contentConsumers.add(pluginId);
      }
    }
  });

  // For both modes, also check if grafana-core is referenced anywhere and add it
  // This handles cases where grafana-core might be referenced but not defined as a plugin
  if (mode === 'add') {
    // Check if grafana-core is referenced as a target in any dependencies or extension points
    Object.values(pluginData).forEach((pluginInfo) => {
      // Check extension point targets
      if (pluginInfo.extensions.extensionPoints) {
        pluginInfo.extensions.extensionPoints.forEach((ep) => {
          if (ep.id && ep.id.includes('grafana-core')) {
            contentConsumers.add('grafana-core');
          }
        });
      }

      // Check if any extensions target grafana-core
      const allExtensions = [
        ...(pluginInfo.extensions.addedLinks || []),
        ...(pluginInfo.extensions.addedComponents || []),
        ...(pluginInfo.extensions.addedFunctions || []),
      ];

      allExtensions.forEach((ext) => {
        if (ext.targets) {
          ext.targets.forEach((target: string) => {
            if (target.includes('grafana-core')) {
              contentConsumers.add('grafana-core');
            }
          });
        }
      });
    });
  }

  // In expose mode, also include all consumers found in the processed graph data
  if (mode === 'expose') {
    // To get all actual consumers (including those like grafana-core that might not be in pluginData),
    // we need to temporarily process the graph and collect all consumer IDs
    const tempExposedComponents = new Map<string, ExposedComponent>();

    // First pass: collect all exposed components (same as in processPluginDataToExposeGraph)
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;
      if (extensions.exposedComponents && extensions.exposedComponents.length > 0) {
        extensions.exposedComponents.forEach((exposedComponent) => {
          if (exposedComponent && exposedComponent.id && exposedComponent.id.trim() !== '') {
            tempExposedComponents.set(exposedComponent.id, {
              id: exposedComponent.id,
              title: exposedComponent.title || exposedComponent.id,
              description: exposedComponent.description || '',
              providingPlugin: pluginId,
              consumers: [], // Will be populated in second pass
            });
          }
        });
      }
    });

    // Second pass: collect dependencies and consumers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const pluginDependencies = pluginInfo.dependencies;
      if (
        pluginDependencies.extensions?.exposedComponents &&
        pluginDependencies.extensions.exposedComponents.length > 0
      ) {
        pluginDependencies.extensions.exposedComponents.forEach((exposedComponentId: string) => {
          if (exposedComponentId.trim() !== '') {
            const exposedComponent = tempExposedComponents.get(exposedComponentId);
            if (exposedComponent) {
              // Add this plugin as a consumer - this is where we capture all consumers
              contentConsumers.add(pluginId);
            }
          }
        });
      }
    });
  }

  // FOR TESTING: Add grafana-core to both modes to verify mechanism works
  contentConsumers.add('grafana-core');

  const result = Array.from(contentConsumers).sort();
  availableConsumersCache.set(mode, result);
  return result;
};

/**
 * Gets content consumer plugin IDs that are actually active (have providers).
 *
 * Unlike getAvailableContentConsumers, this only returns consumers that actually
 * have content providers connecting to them, making it useful for default selections.
 *
 * @param mode - Visualization mode: 'add' or 'expose'
 * @returns Sorted array of plugin IDs that are active content consumers
 */
export const getActiveContentConsumers = (mode: 'add' | 'expose' = 'add'): string[] => {
  if (activeConsumersCache.has(mode)) {
    return activeConsumersCache.get(mode)!;
  }

  const activeConsumers = new Set<string>();
  const pluginData = getPluginData();

  if (mode === 'expose') {
    // In expose mode, active consumers are plugins that actually depend on components that exist
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const pluginDependencies = pluginInfo.dependencies;

      if (
        pluginDependencies.extensions?.exposedComponents &&
        pluginDependencies.extensions.exposedComponents.length > 0
      ) {
        // Check if any of the components they depend on are actually exposed by other plugins
        const hasValidDependencies = pluginDependencies.extensions.exposedComponents.some(
          (exposedComponentId: string) => {
            return Object.values(pluginData).some((otherPlugin) => {
              return otherPlugin.extensions.exposedComponents?.some((comp) => comp.id === exposedComponentId);
            });
          }
        );

        if (hasValidDependencies) {
          activeConsumers.add(pluginId);
        }
      }
    });

    // Also include all consumers that are actually referenced in the processed graph
    // This captures consumers like "grafana-core" that might be referenced but not defined as plugins
    try {
      const tempGraphData = processPluginDataToExposeGraph(
        {
          visualizationMode: 'expose',
          selectedContentProviders: [],
          selectedContentConsumers: [],
          showDependencyTypes: true,
          showDescriptions: false,
          layoutType: 'hierarchical',
          linkExtensionColor: '#37872d',
          componentExtensionColor: '#ff9900',
          functionExtensionColor: '#e02f44',
        },
        pluginData
      );

      tempGraphData.exposedComponents?.forEach((comp) => {
        comp.consumers.forEach((consumerId) => {
          activeConsumers.add(consumerId);
        });
      });
    } catch (error) {
      // If processing fails, continue without the additional consumers
      console.warn('Failed to process graph data for consumer detection:', error);
    }
  } else {
    // In add mode, active consumers are plugins with extension points that have providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points
        const hasProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return [
            ...(otherExtensions.addedLinks || []),
            ...(otherExtensions.addedComponents || []),
            ...(otherExtensions.addedFunctions || []),
          ].some((item) => item.targets?.some((target: string) => extensionPointIds.includes(target)));
        });

        if (hasProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  }

  // FOR TESTING: Add grafana-core to both modes to verify mechanism works
  activeConsumers.add('grafana-core');

  const result = Array.from(activeConsumers).sort();
  activeConsumersCache.set(mode, result);
  return result;
};

// Create sample data for demonstration that matches the new data format
export const createSampleData = (): GraphData => {
  // This will now use the actual data from data.json
  return processPluginDataToGraph(getDefaultOptions());
};

export const getDefaultOptions = (): PanelOptions => ({
  // Visualization mode
  visualizationMode: 'add', // Default to 'add' mode

  showDependencyTypes: true,
  showDescriptions: false, // Hidden by default
  layoutType: 'hierarchical',

  // Filtering options
  selectedContentProviders: [], // Empty array means all providers are selected
  selectedContentConsumers: [], // Empty array means all consumers are selected

  // Color options for extension types
  linkExtensionColor: '#37872d', // Green for link extensions
  componentExtensionColor: '#ff9900', // Orange for component extensions
  functionExtensionColor: '#e02f44', // Red for function extensions
});
