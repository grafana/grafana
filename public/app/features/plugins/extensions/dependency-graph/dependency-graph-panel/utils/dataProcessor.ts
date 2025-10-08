import { AppPluginConfig, PanelData } from '@grafana/data';
import { t } from '@grafana/i18n';

import pluginDataFallback from '../data.json';
import {
  ExposedComponent,
  Extension,
  ExtensionPoint,
  GraphData,
  PanelOptions,
  PluginDependency,
  PluginNode,
} from '../types';

// Cache for expensive calculations
const cache = new Map<string, GraphData>();
const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

// Type guard helpers
function hasExtensionPointsProperty(obj: unknown): obj is { extensionPoints: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'extensionPoints' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).extensionPoints)
  );
}

function hasAddedLinksProperty(obj: unknown): obj is { addedLinks: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedLinks' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedLinks)
  );
}

function hasAddedComponentsProperty(obj: unknown): obj is { addedComponents: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedComponents' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedComponents)
  );
}

function hasAddedFunctionsProperty(obj: unknown): obj is { addedFunctions: unknown[] } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'addedFunctions' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    Array.isArray((obj as unknown as Record<string, unknown>).addedFunctions)
  );
}

function hasDescriptionProperty(obj: unknown): obj is { description: string } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'description' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    typeof (obj as unknown as Record<string, unknown>).description === 'string'
  );
}

function isExtensionPointObject(
  obj: unknown
): obj is { id: string; title?: string; description?: string; definingPlugin?: string } {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    typeof (obj as unknown as Record<string, unknown>).id === 'string'
  );
}

function isExtensionObject(
  obj: unknown
): obj is { targets?: string | string[]; id?: string; title?: string; description?: string } {
  return obj !== null && typeof obj === 'object';
}

/**
 * Gets plugin data from window.grafanaBootData.settings.apps with fallback to data.json
 *
 * @returns Plugin data object
 */
const getPluginData = (): Record<string, AppPluginConfig> => {
  // Use window.grafanaBootData.settings.apps if available, otherwise fallback to data.json
  if (typeof window !== 'undefined' && window.grafanaBootData?.settings?.apps) {
    if (ENABLE_DEBUG_LOGS) {
      console.log(
        'Using window.grafanaBootData.settings.apps',
        Object.keys(window.grafanaBootData.settings.apps).length,
        'plugins'
      );
    }
    return window.grafanaBootData.settings.apps;
  }

  // Fallback to data.json
  if (ENABLE_DEBUG_LOGS) {
    console.log('Using data.json fallback', Object.keys(pluginDataFallback).length, 'plugins');
  }
  // Type assertion to handle the fallback to data.json
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return pluginDataFallback as unknown as Record<string, AppPluginConfig>;
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
    extensionPoints: options.selectedExtensionPoints?.slice().sort(), // Add extension points to cache key
    contentConsumersForExtensionPoint: options.selectedContentConsumersForExtensionPoint?.slice().sort(), // Add content consumers for extension point to cache key
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
 *   visualizationMode: 'addedlinks',
 *   selectedContentProviders: [],
 *   selectedContentConsumers: []
 * };
 * const graphData = processPluginDataToGraph(options);
 * ```
 */
export const processPluginDataToGraph = (options: PanelOptions): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToGraph - called with options:', options);
  }

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
  if (options.visualizationMode === 'exposedComponents') {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to exposed components mode');
    }
    result = processPluginDataToExposeGraph(options, pluginData);
  } else if (options.visualizationMode === 'extensionpoint') {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to extension point mode');
    }
    result = processPluginDataToExtensionPointGraph(options, pluginData);
  } else if (options.visualizationMode === 'addedlinks') {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to added links mode');
    }
    result = processPluginDataToAddedLinksGraph(options, pluginData);
  } else if (options.visualizationMode === 'addedcomponents') {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to added components mode');
    }
    result = processPluginDataToAddedComponentsGraph(options, pluginData);
  } else if (options.visualizationMode === 'addedfunctions') {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to added functions mode');
    }
    result = processPluginDataToAddedFunctionsGraph(options, pluginData);
  } else {
    if (ENABLE_DEBUG_LOGS) {
      console.log('processPluginDataToGraph - routing to added links mode');
    }
    result = processPluginDataToAddedLinksGraph(options, pluginData);
  }

  // Cache the result
  cache.set(cacheKey, result);
  return result;
};

/**
 * Processes plugin data for "addedlinks" mode visualization.
 *
 * In addedlinks mode, the visualization shows:
 * - Content providers (left side): Plugins that add link extensions only
 * - Extension points (right side): Only extension points that are targeted by link extensions
 * - Dependencies: Show which providers add link extensions to which extension points
 *
 * @param options - Panel options containing filtering settings
 * @param pluginData - Raw plugin data from data.json
 * @returns GraphData with nodes, dependencies, and extension points for addedlinks mode
 */
const processPluginDataToAddedLinksGraph = (
  options: PanelOptions,
  pluginData: Record<string, AppPluginConfig>
): GraphData => {
  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Pre-compute plugin entries for better performance
  const pluginEntries = Object.entries(pluginData);

  // Process each plugin from data.json
  pluginEntries.forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider (has addedLinks only)
    const isContentProvider = extensions.addedLinks && extensions.addedLinks.length > 0;

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
          const extensionType = determineExtensionPointType(extensionPoint.id, pluginData);
          const processedExtensionPoint = {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [],
            extensionType: extensionType,
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

    // Process content that this plugin provides (only link extensions)
    if (isContentProvider) {
      // Process addedLinks only
      extensions.addedLinks?.forEach((link) => {
        (Array.isArray(link.targets) ? link.targets : [link.targets]).forEach((target: string) => {
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
    }
  });

  // Filter extension points to only include those that are targeted by link extensions
  let filteredExtensionPoints = Array.from(extensionPoints.values()).filter((ep) => {
    // Check if this extension point is targeted by any link extensions
    return pluginEntries.some(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;
      return extensions.addedLinks?.some((link) => {
        const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
        return targets.includes(ep.id);
      });
    });
  });

  // Apply filtering based on selectedContentProviders
  let filteredDependencies = dependencies;
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

  // Filter nodes to only include those that are relevant to link extensions and filtering
  const filteredNodes = Array.from(nodes.values()).filter((node) => {
    // Include if it's a provider of link extensions or a consumer with link-targeted extension points
    const pluginInfo = pluginData[node.id];
    if (!pluginInfo) {
      return false;
    }

    const extensions = pluginInfo.extensions;

    // Include if it provides link extensions (and is selected if filtering is applied)
    if (extensions.addedLinks && extensions.addedLinks.length > 0) {
      if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
        return options.selectedContentProviders.includes(node.id);
      }
      return true;
    }

    // Include if it defines extension points that are targeted by link extensions (and is selected if filtering is applied)
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      const hasRelevantExtensionPoints = extensions.extensionPoints.some((ep) => {
        return filteredExtensionPoints.some((filteredEp) => filteredEp.id === ep.id);
      });

      if (hasRelevantExtensionPoints) {
        if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
          return options.selectedContentConsumers.includes(node.id);
        }
        return true;
      }
    }

    return false;
  });

  const result: GraphData = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToAddedLinksGraph - final result:', result);
    console.log('Final extension points count:', result.extensionPoints.length);
    result.extensionPoints.forEach((ep, index) => {
      console.log(`Final extension point ${index}:`, {
        id: ep.id,
        definingPlugin: ep.definingPlugin,
        providers: ep.providers,
        extensionType: ep.extensionType,
      });
    });
  }

  return result;
};

/**
 * Processes plugin data for "addedcomponents" mode visualization.
 *
 * In addedcomponents mode, the visualization shows:
 * - Content providers (left side): Plugins that add component extensions only
 * - Extension points (right side): Only extension points that are targeted by component extensions
 * - Dependencies: Show which providers add component extensions to which extension points
 *
 * @param options - Panel options containing filtering settings
 * @param pluginData - Raw plugin data from data.json
 * @returns GraphData with nodes, dependencies, and extension points for addedcomponents mode
 */
const processPluginDataToAddedComponentsGraph = (
  options: PanelOptions,
  pluginData: Record<string, AppPluginConfig>
): GraphData => {
  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Pre-compute plugin entries for better performance
  const pluginEntries = Object.entries(pluginData);

  // Process each plugin from data.json
  pluginEntries.forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider (has addedComponents only)
    const isContentProvider = extensions.addedComponents && extensions.addedComponents.length > 0;

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
          const extensionType = determineExtensionPointType(extensionPoint.id, pluginData);
          const processedExtensionPoint = {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [],
            extensionType: extensionType,
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

    // Process content that this plugin provides (only component extensions)
    if (isContentProvider) {
      // Process addedComponents only
      extensions.addedComponents?.forEach((component) => {
        (Array.isArray(component.targets) ? component.targets : [component.targets]).forEach((target: string) => {
          // Create dependency from this plugin to the target extension point
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides component to ${target}`,
          });

          // Find the defining plugin for this target extension point
          const extensionDetails = findExtensionPointDetails(target, pluginData);
          if (extensionDetails.definingPlugin && !extensionPoints.has(target)) {
            // Create extension point if it doesn't exist
            extensionPoints.set(target, {
              id: target,
              definingPlugin: extensionDetails.definingPlugin,
              providers: [],
              extensionType: 'component',
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
    }
  });

  // Filter extension points to only include those that are targeted by component extensions
  let filteredExtensionPoints = Array.from(extensionPoints.values()).filter((ep) => {
    // Check if this extension point is targeted by any component extensions
    return pluginEntries.some(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;
      return extensions.addedComponents?.some((component) => {
        const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
        return targets.includes(ep.id);
      });
    });
  });

  // Apply filtering based on selectedContentProviders
  let filteredDependencies = dependencies;
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

  // Filter nodes to only include those that are relevant to component extensions and filtering
  const filteredNodes = Array.from(nodes.values()).filter((node) => {
    // Include if it's a provider of component extensions or a consumer with component-targeted extension points
    const pluginInfo = pluginData[node.id];
    if (!pluginInfo) {
      return false;
    }

    const extensions = pluginInfo.extensions;

    // Include if it provides component extensions (and is selected if filtering is applied)
    if (extensions.addedComponents && extensions.addedComponents.length > 0) {
      if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
        return options.selectedContentProviders.includes(node.id);
      }
      return true;
    }

    // Include if it defines extension points that are targeted by component extensions (and is selected if filtering is applied)
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      const hasRelevantExtensionPoints = extensions.extensionPoints.some((ep) => {
        return filteredExtensionPoints.some((filteredEp) => filteredEp.id === ep.id);
      });

      if (hasRelevantExtensionPoints) {
        if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
          return options.selectedContentConsumers.includes(node.id);
        }
        return true;
      }
    }

    return false;
  });

  const result: GraphData = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToAddedComponentsGraph - final result:', result);
    console.log('Final extension points count:', result.extensionPoints.length);
    result.extensionPoints.forEach((ep, index) => {
      console.log(`Final extension point ${index}:`, {
        id: ep.id,
        definingPlugin: ep.definingPlugin,
        providers: ep.providers,
        extensionType: ep.extensionType,
      });
    });
  }

  return result;
};

/**
 * Processes plugin data for "addedfunctions" mode visualization.
 *
 * In addedfunctions mode, the visualization shows:
 * - Content providers (left side): Plugins that add function extensions only
 * - Extension points (right side): Only extension points that are targeted by function extensions
 * - Dependencies: Show which providers add function extensions to which extension points
 *
 * @param options - Panel options containing filtering settings
 * @param pluginData - Raw plugin data from data.json
 * @returns GraphData with nodes, dependencies, and extension points for addedfunctions mode
 */
const processPluginDataToAddedFunctionsGraph = (
  options: PanelOptions,
  pluginData: Record<string, AppPluginConfig>
): GraphData => {
  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();

  // Pre-compute plugin entries for better performance
  const pluginEntries = Object.entries(pluginData);

  // Process each plugin from data.json
  pluginEntries.forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    // Check if this plugin is a content provider (has addedFunctions only)
    const isContentProvider = extensions.addedFunctions && extensions.addedFunctions.length > 0;

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
          const extensionType = determineExtensionPointType(extensionPoint.id, pluginData);
          const processedExtensionPoint = {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [],
            extensionType: extensionType,
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

    // Process content that this plugin provides (only function extensions)
    if (isContentProvider) {
      // Process addedFunctions only
      extensions.addedFunctions?.forEach((function_) => {
        (Array.isArray(function_.targets) ? function_.targets : [function_.targets]).forEach((target: string) => {
          // Create dependency from this plugin to the target extension point
          dependencies.push({
            source: pluginId,
            target: target,
            type: 'extends',
            description: `${getDisplayName(pluginId)} provides function to ${target}`,
          });

          // Find the defining plugin for this target extension point
          const extensionDetails = findExtensionPointDetails(target, pluginData);
          if (extensionDetails.definingPlugin && !extensionPoints.has(target)) {
            // Create extension point if it doesn't exist
            extensionPoints.set(target, {
              id: target,
              definingPlugin: extensionDetails.definingPlugin,
              providers: [],
              extensionType: 'function',
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
    }
  });

  // Filter extension points to only include those that are targeted by function extensions
  let filteredExtensionPoints = Array.from(extensionPoints.values()).filter((ep) => {
    // Check if this extension point is targeted by any function extensions
    return pluginEntries.some(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;
      return extensions.addedFunctions?.some((function_) => {
        const targets = Array.isArray(function_.targets) ? function_.targets : [function_.targets];
        return targets.includes(ep.id);
      });
    });
  });

  // Apply filtering based on selectedContentProviders
  let filteredDependencies = dependencies;
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

  // Filter nodes to only include those that are relevant to function extensions and filtering
  const filteredNodes = Array.from(nodes.values()).filter((node) => {
    // Include if it's a provider of function extensions or a consumer with function-targeted extension points
    const pluginInfo = pluginData[node.id];
    if (!pluginInfo) {
      return false;
    }

    const extensions = pluginInfo.extensions;

    // Include if it provides function extensions (and is selected if filtering is applied)
    if (extensions.addedFunctions && extensions.addedFunctions.length > 0) {
      if (options.selectedContentProviders && options.selectedContentProviders.length > 0) {
        return options.selectedContentProviders.includes(node.id);
      }
      return true;
    }

    // Include if it defines extension points that are targeted by function extensions (and is selected if filtering is applied)
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      const hasRelevantExtensionPoints = extensions.extensionPoints.some((ep) => {
        return filteredExtensionPoints.some((filteredEp) => filteredEp.id === ep.id);
      });

      if (hasRelevantExtensionPoints) {
        if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
          return options.selectedContentConsumers.includes(node.id);
        }
        return true;
      }
    }

    return false;
  });

  const result: GraphData = {
    nodes: filteredNodes,
    dependencies: filteredDependencies,
    extensionPoints: filteredExtensionPoints,
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToAddedFunctionsGraph - final result:', result);
    console.log('Final extension points count:', result.extensionPoints.length);
    result.extensionPoints.forEach((ep, index) => {
      console.log(`Final extension point ${index}:`, {
        id: ep.id,
        definingPlugin: ep.definingPlugin,
        providers: ep.providers,
        extensionType: ep.extensionType,
      });
    });
  }

  return result;
};

/**
 * Processes plugin data for "exposedComponents" mode visualization.
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
            const dependency = {
              source: exposedComponent.providingPlugin, // Provider is the source
              target: pluginId, // Consumer is the target
              type: 'depends' as const,
              description: `${getDisplayName(pluginId)} consumes ${exposedComponent.title} from ${getDisplayName(
                exposedComponent.providingPlugin
              )}`,
            };
            dependencies.push(dependency);

            if (ENABLE_DEBUG_LOGS) {
              console.log('Created dependency:', dependency);
            }

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
      return options.selectedContentProviders.includes(dep.source);
    });
  }

  // Filter by selected content consumers (plugins that consume exposed components)
  if (options.selectedContentConsumers && options.selectedContentConsumers.length > 0) {
    filteredDependencies = filteredDependencies.filter((dep) => options.selectedContentConsumers.includes(dep.target));
    // Also filter exposed components to only show those consumed by selected consumers
    filteredExposedComponents = filteredExposedComponents.filter((comp) =>
      comp.consumers.some((consumer) => options.selectedContentConsumers.includes(consumer))
    );
  }

  // Get the set of active plugins based on filtered data
  const activeProviders = new Set(filteredExposedComponents.map((comp) => comp.providingPlugin));
  const activeConsumers = new Set(filteredDependencies.map((dep) => dep.target));

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
    console.log('processPluginDataToExposeGraph - dependencies:', result.dependencies);
    console.log('processPluginDataToExposeGraph - exposedComponents:', result.exposedComponents);
    console.log('processPluginDataToExposeGraph - nodes:', result.nodes);
  }

  return result;
};

/**
 * Processes plugin data for "extensionpoint" mode visualization.
 *
 * In extension point mode, the visualization shows:
 * - Extensions (left side): Link, component, and function extensions that extend extension points
 * - Extension Points (right side): The extension points being extended
 * - Arrows: From extensions to their target extension points
 *
 * @param options - Panel options including filtering settings
 * @param pluginData - Raw plugin data from data.json or window.grafanaBootData
 * @returns Processed graph data for extension point mode visualization
 */
export const processPluginDataToExtensionPointGraph = (
  options: PanelOptions,
  pluginData: Record<string, AppPluginConfig>
): GraphData => {
  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExtensionPointGraph - processing extension point mode data');
  }

  const nodes: Map<string, PluginNode> = new Map();
  const dependencies: PluginDependency[] = [];
  const extensionPoints: Map<string, ExtensionPoint> = new Map();
  const extensions: Map<string, Extension> = new Map();

  // Get filter options
  const selectedExtensionPoints = options.selectedExtensionPoints || [];
  const selectedContentProviders = options.selectedContentProviders || [];
  const selectedContentConsumersForExtensionPoint = options.selectedContentConsumersForExtensionPoint || [];
  const shouldFilterExtensionPoints = selectedExtensionPoints.length > 0;
  const shouldFilterContentProviders = selectedContentProviders.length > 0;
  const shouldFilterContentConsumersForExtensionPoint = selectedContentConsumersForExtensionPoint.length > 0;

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExtensionPointGraph - selectedExtensionPoints:', selectedExtensionPoints);
    console.log('processPluginDataToExtensionPointGraph - selectedContentProviders:', selectedContentProviders);
    console.log(
      'processPluginDataToExtensionPointGraph - selectedContentConsumersForExtensionPoint:',
      selectedContentConsumersForExtensionPoint
    );
    console.log('processPluginDataToExtensionPointGraph - shouldFilterExtensionPoints:', shouldFilterExtensionPoints);
    console.log('processPluginDataToExtensionPointGraph - shouldFilterContentProviders:', shouldFilterContentProviders);
    console.log(
      'processPluginDataToExtensionPointGraph - shouldFilterContentConsumersForExtensionPoint:',
      shouldFilterContentConsumersForExtensionPoint
    );
  }

  // Collect explicitly defined extension points
  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    // Type guard to check if pluginExtensions has extensionPoints property
    if (hasExtensionPointsProperty(pluginExtensions) && pluginExtensions.extensionPoints.length > 0) {
      const extensionPointsArray = pluginExtensions.extensionPoints;
      extensionPointsArray.forEach((extensionPoint) => {
        if (isExtensionPointObject(extensionPoint) && extensionPoint.id.trim() !== '') {
          // Filter by selected extension points if specified
          if (shouldFilterExtensionPoints && !selectedExtensionPoints.includes(extensionPoint.id)) {
            return;
          }

          extensionPoints.set(extensionPoint.id, {
            id: extensionPoint.id,
            definingPlugin: pluginId,
            providers: [], // Will be populated later
            extensionType: determineExtensionPointType(extensionPoint.id, pluginData),
            title: extensionPoint.title,
            description: extensionPoint.description,
          });
        }
      });
    }
  });

  // If filtering by selected extension points, also add any targets that are not explicitly defined
  if (shouldFilterExtensionPoints) {
    selectedExtensionPoints.forEach((targetId) => {
      if (!extensionPoints.has(targetId)) {
        // This target is not explicitly defined as an extension point, but we need to show it
        const extensionDetails = findExtensionPointDetails(targetId, pluginData);
        extensionPoints.set(targetId, {
          id: targetId,
          definingPlugin: extensionDetails.definingPlugin,
          providers: [], // Will be populated later
          extensionType: determineExtensionPointType(targetId, pluginData),
          title: extensionDetails.title || '',
          description: extensionDetails.description || '',
        });
      }
    });
  }

  // Second pass: collect all extensions (links, components, functions) and their targets
  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    if (!pluginExtensions) {
      return;
    }

    // Skip this plugin if content provider filtering is enabled and this plugin is not selected
    if (shouldFilterContentProviders && !selectedContentProviders.includes(pluginId)) {
      return;
    }

    // Process added links
    if (hasAddedLinksProperty(pluginExtensions) && pluginExtensions.addedLinks.length > 0) {
      const addedLinks = pluginExtensions.addedLinks;
      addedLinks.forEach((link) => {
        if (isExtensionObject(link) && link.targets) {
          const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              // Filter by selected extension points if specified
              if (shouldFilterExtensionPoints && !selectedExtensionPoints.includes(target)) {
                return;
              }

              const extensionId = `${pluginId}-link-${target}-${link.title || 'Link Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );

              if (ENABLE_DEBUG_LOGS && target === 'grafana-slo-app/service-actions/v1') {
                console.log('Adding extension:', {
                  pluginId,
                  target,
                  title: link.title,
                  extensionId,
                });
              }

              extensions.set(extensionId, {
                id: extensionId,
                title: link.title || 'Link Extension',
                description: link.description,
                type: 'link' as const,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
              });
            }
          });
        }
      });
    }

    // Process added components
    if (hasAddedComponentsProperty(pluginExtensions) && pluginExtensions.addedComponents.length > 0) {
      const addedComponents = pluginExtensions.addedComponents;
      addedComponents.forEach((component) => {
        if (isExtensionObject(component) && component.targets) {
          const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              // Filter by selected extension points if specified
              if (shouldFilterExtensionPoints && !selectedExtensionPoints.includes(target)) {
                return;
              }

              const extensionId = `${pluginId}-component-${target}-${component.title || 'Component Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.set(extensionId, {
                id: extensionId,
                title: component.title || 'Component Extension',
                description: component.description,
                type: 'component' as const,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
              });
            }
          });
        }
      });
    }

    // Process added functions
    if (hasAddedFunctionsProperty(pluginExtensions) && pluginExtensions.addedFunctions.length > 0) {
      const addedFunctions = pluginExtensions.addedFunctions;
      addedFunctions.forEach((func) => {
        if (isExtensionObject(func) && func.targets) {
          const targets = Array.isArray(func.targets) ? func.targets : [func.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              // Filter by selected extension points if specified
              if (shouldFilterExtensionPoints && !selectedExtensionPoints.includes(target)) {
                return;
              }

              const extensionId = `${pluginId}-function-${target}-${func.title || 'Function Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.set(extensionId, {
                id: extensionId,
                title: func.title || 'Function Extension',
                description: func.description,
                type: 'function' as const,
                providingPlugin: pluginId,
                targetExtensionPoint: target,
              });
            }
          });
        }
      });
    }
  });

  // Add Grafana core extension points since they're not declared in data.json
  const grafanaCoreExtensionPoints = [
    'grafana/alerting/instance/action',
    'grafana/alerting/home',
    'grafana/alerting/alertingrule/action',
    'grafana/alerting/recordingrule/action',
    'grafana/alerting/alertingrule/queryeditor',
    'grafana/commandpalette/action',
    'grafana/dashboard/panel/menu',
    'grafana/datasources/config',
    'grafana/datasources/config/actions',
    'grafana/datasources/config/error-status',
    'grafana/datasources/config/status',
    'grafana/explore/toolbar/action',
    'grafana/user/profile/tab',
    'grafana/traceview/details',
    'grafana/traceview/header/actions',
    'grafana/query-editor-row/adaptivetelemetry/v1',
    'grafana/traceview/resource-attributes',
    'grafana/logsview/resource-attributes',
    'grafana/app/chrome/v1',
    'grafana/extension-sidebar/v0-alpha',
  ];

  grafanaCoreExtensionPoints.forEach((epId) => {
    // Only add if not already present and if filtering allows it
    if (!extensionPoints.has(epId)) {
      // Check if this extension point should be included based on filtering
      let shouldInclude = true;

      if (shouldFilterExtensionPoints && !selectedExtensionPoints.includes(epId)) {
        shouldInclude = false;
      }

      if (
        shouldFilterContentConsumersForExtensionPoint &&
        !selectedContentConsumersForExtensionPoint.includes('grafana-core')
      ) {
        shouldInclude = false;
      }

      if (shouldInclude) {
        extensionPoints.set(epId, {
          id: epId,
          definingPlugin: 'grafana-core',
          providers: [], // Will be populated later
          extensionType: determineExtensionPointType(epId, pluginData),
          title: epId.replace('grafana/', '').replace(/\//g, ' '),
          description: t(
            'extensions.dependency-graph.grafana-core-extension-point',
            'Grafana core extension point: {{epId}}',
            { epId }
          ),
        });
      }
    }
  });

  // Apply content consumer filtering for extension point mode FIRST
  if (shouldFilterContentConsumersForExtensionPoint) {
    // Filter extension points to only include those defined by selected content consumers
    const filteredExtensionPoints = new Map<string, ExtensionPoint>();
    extensionPoints.forEach((ep, epId) => {
      if (selectedContentConsumersForExtensionPoint.includes(ep.definingPlugin)) {
        filteredExtensionPoints.set(epId, ep);
      }
    });
    extensionPoints.clear();
    filteredExtensionPoints.forEach((ep, epId) => extensionPoints.set(epId, ep));

    // Filter extensions to only include those targeting remaining extension points
    const remainingExtensionPointIds = new Set(Array.from(extensionPoints.keys()));
    const filteredExtensions = new Map<string, Extension>();
    extensions.forEach((ext, extId) => {
      if (remainingExtensionPointIds.has(ext.targetExtensionPoint)) {
        filteredExtensions.set(extId, ext);
      }
    });
    extensions.clear();
    filteredExtensions.forEach((ext, extId) => extensions.set(extId, ext));
  }

  // Apply content provider filtering to extension points AFTER content consumer filtering
  // If content provider filtering is enabled, only show extension points that have extensions from selected providers
  // BUT if extension point filtering is also enabled, show the intersection
  if (shouldFilterContentProviders && shouldFilterExtensionPoints) {
    // Both filters are applied: show intersection
    // Extension points are already filtered by selectedExtensionPoints, so we just need to ensure
    // they have extensions from selected providers
    const extensionPointIdsWithExtensions = new Set<string>();
    extensions.forEach((extension) => {
      extensionPointIdsWithExtensions.add(extension.targetExtensionPoint);
    });

    // Filter extension points to only include those that have extensions from selected providers
    const filteredExtensionPointsArray = Array.from(extensionPoints.values()).filter((ep) =>
      extensionPointIdsWithExtensions.has(ep.id)
    );

    // Clear and repopulate extension points map with filtered results
    extensionPoints.clear();
    filteredExtensionPointsArray.forEach((ep) => {
      extensionPoints.set(ep.id, ep);
    });
  }
  // If only content provider filter is applied (no extension point filter), keep all extension points
  // This ensures we show all defined extension points even if they don't have extensions from selected providers

  // The content provider filtering will only affect which extensions are shown, not which extension points are shown

  // Third pass: create plugin nodes for all plugins that have extensions or extension points
  // Always include selected content providers as nodes, even if they don't have extensions
  const allPluginIds = new Set<string>();

  if (shouldFilterContentConsumersForExtensionPoint) {
    // When filtering by content consumers, only include:
    // 1. Defining plugins of the remaining extension points (after filtering)
    // 2. Providers that have extensions targeting those extension points
    extensionPoints.forEach((ep) => allPluginIds.add(ep.definingPlugin));
    extensions.forEach((extension) => allPluginIds.add(extension.providingPlugin));
  } else {
    // Normal behavior: include all plugins that have extensions or extension points
    extensions.forEach((extension) => allPluginIds.add(extension.providingPlugin));
    extensionPoints.forEach((ep) => allPluginIds.add(ep.definingPlugin));
  }

  // If content provider filtering is enabled, always include the selected providers as nodes
  if (shouldFilterContentProviders) {
    selectedContentProviders.forEach((providerId) => {
      allPluginIds.add(providerId);
    });
  }

  allPluginIds.forEach((pluginId) => {
    if (pluginId === 'grafana-core') {
      // Special case for grafana-core since it's not in pluginData
      nodes.set(pluginId, {
        id: pluginId,
        name: pluginId,
        type: 'app',
        version: 'core',
        description: t('extensions.dependency-graph.grafana-core-application', 'Grafana Core Application'),
      });
    } else {
      const pluginInfo = pluginData[pluginId];
      if (pluginInfo) {
        nodes.set(pluginId, {
          id: pluginId,
          name: pluginId,
          type: 'app',
          version: pluginInfo.version,
          description: hasDescriptionProperty(pluginInfo) ? pluginInfo.description : '',
        });
      }
    }
  });

  const result: GraphData = {
    nodes: Array.from(nodes.values()),
    dependencies,
    extensionPoints: Array.from(extensionPoints.values()),
    extensions: Array.from(extensions.values()),
  };

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExtensionPointGraph - final result:', result);
    console.log('processPluginDataToExtensionPointGraph - extensions count:', extensions.size);
    console.log('processPluginDataToExtensionPointGraph - extension points count:', extensionPoints.size);
    console.log('processPluginDataToExtensionPointGraph - filtering applied:', {
      shouldFilterExtensionPoints,
      shouldFilterContentProviders,
      shouldFilterContentConsumersForExtensionPoint,
      selectedExtensionPoints,
      selectedContentProviders,
      selectedContentConsumersForExtensionPoint,
    });
    console.log(
      'processPluginDataToExtensionPointGraph - extensions:',
      Array.from(extensions.values()).map((e) => ({
        id: e.id,
        title: e.title,
        plugin: e.providingPlugin,
        target: e.targetExtensionPoint,
      }))
    );
    console.log(
      'processPluginDataToExtensionPointGraph - extension points:',
      Array.from(extensionPoints.values()).map((ep) => ({
        id: ep.id,
        title: ep.title,
        definingPlugin: ep.definingPlugin,
      }))
    );
  }

  return result;
};

// Helper function to determine extension point type based on what extensions target it
const determineExtensionPointType = (
  extensionPointId: string,
  pluginData: Record<string, AppPluginConfig>
): 'link' | 'component' | 'function' => {
  try {
    const types = new Set<'link' | 'component' | 'function'>();

    // Check all plugins for extensions that target this extension point
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      try {
        const extensions = pluginInfo.extensions;
        if (!extensions) {
          return;
        }

        // Check added links
        if (hasAddedLinksProperty(extensions) && extensions.addedLinks.length > 0) {
          extensions.addedLinks.forEach((link) => {
            if (isExtensionObject(link) && link.targets) {
              const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
              if (targets.includes(extensionPointId)) {
                types.add('link');
              }
            }
          });
        }

        // Check added components
        if (hasAddedComponentsProperty(extensions) && extensions.addedComponents.length > 0) {
          extensions.addedComponents.forEach((component) => {
            if (isExtensionObject(component) && component.targets) {
              const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
              if (targets.includes(extensionPointId)) {
                types.add('component');
              }
            }
          });
        }

        // Check added functions
        if (hasAddedFunctionsProperty(extensions) && extensions.addedFunctions.length > 0) {
          extensions.addedFunctions.forEach((func) => {
            if (isExtensionObject(func) && func.targets) {
              const targets = Array.isArray(func.targets) ? func.targets : [func.targets];
              if (targets.includes(extensionPointId)) {
                types.add('function');
              }
            }
          });
        }
      } catch (error) {
        console.warn(`Error processing extensions for plugin ${pluginId}:`, error);
      }
    });

    // Use a more balanced approach: if multiple types exist, prefer the most common one

    // If only one type, return it
    if (types.size === 1) {
      return Array.from(types)[0];
    }

    // If multiple types, use a more balanced priority: link > component > function
    // This is because link extension points are more common and should be the default
    if (types.has('link')) {
      return 'link';
    }
    if (types.has('component')) {
      return 'component';
    }
    if (types.has('function')) {
      return 'function';
    }

    // Default fallback
    return 'link';
  } catch (error) {
    console.warn(`Error determining extension point type for ${extensionPointId}:`, error);
    return 'link'; // Safe fallback
  }
};

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
const availableExtensionPointsCache = new Map<string, string[]>();
const availableExtensionsCache = new Map<string, string[]>();

/**
 * Gets all available content provider plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'exposedComponents' (plugins that expose components), 'extensionpoint' (plugins that provide extensions), 'addedlinks' (plugins that add link extensions), 'addedcomponents' (plugins that add component extensions), or 'addedfunctions' (plugins that add function extensions)
 * @returns Sorted array of plugin IDs that act as content providers
 */
export const getAvailableContentProviders = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (availableProvidersCache.has(mode)) {
    return availableProvidersCache.get(mode)!;
  }

  const contentProviders = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    if (mode === 'exposedComponents') {
      // In expose mode, content providers are plugins that expose components
      const exposesComponents =
        extensions.exposedComponents &&
        extensions.exposedComponents.length > 0 &&
        extensions.exposedComponents.some((comp) => comp && comp.id && comp.id.trim() !== '');

      if (exposesComponents) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // In extension point mode, content providers are plugins that provide extensions
      const providesExtensions =
        (extensions.addedLinks && extensions.addedLinks.length > 0) ||
        (extensions.addedComponents && extensions.addedComponents.length > 0) ||
        (extensions.addedFunctions && extensions.addedFunctions.length > 0);

      if (providesExtensions) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content providers are plugins that add link extensions
      const addsLinks = extensions.addedLinks && extensions.addedLinks.length > 0;

      if (addsLinks) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content providers are plugins that add component extensions
      const addsComponents = extensions.addedComponents && extensions.addedComponents.length > 0;

      if (addsComponents) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content providers are plugins that add function extensions
      const addsFunctions = extensions.addedFunctions && extensions.addedFunctions.length > 0;

      if (addsFunctions) {
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
 * @param mode - Visualization mode: 'exposedComponents' (plugins that consume exposed components), 'extensionpoint' (plugins that define extension points), 'addedlinks' (plugins that define extension points targeted by link extensions), 'addedcomponents' (plugins that define extension points targeted by component extensions), or 'addedfunctions' (plugins that define extension points targeted by function extensions)
 * @returns Sorted array of plugin IDs that act as content consumers
 */
export const getAvailableContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (availableConsumersCache.has(mode)) {
    return availableConsumersCache.get(mode)!;
  }

  const contentConsumers = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    if (mode === 'exposedComponents') {
      // In expose mode, content consumers are plugins that depend on exposed components
      const pluginDependencies = pluginInfo.dependencies;
      const dependsOnExposedComponents =
        pluginDependencies.extensions?.exposedComponents && pluginDependencies.extensions.exposedComponents.length > 0;

      if (dependsOnExposedComponents) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // In extension point mode, content consumers are plugins that define extension points
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content consumers are plugins that define extension points targeted by link extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by link extensions
        const hasLinkTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any link extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedLinks &&
              otherExtensions.addedLinks.some((link) => link.targets && link.targets.includes(ep.id))
            );
          });
        });

        if (hasLinkTargets) {
          contentConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content consumers are plugins that define extension points targeted by component extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by component extensions
        const hasComponentTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any component extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedComponents &&
              otherExtensions.addedComponents.some(
                (component) => component.targets && component.targets.includes(ep.id)
              )
            );
          });
        });

        if (hasComponentTargets) {
          contentConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content consumers are plugins that define extension points targeted by function extensions
      const extensions = pluginInfo.extensions;
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        // Check if any of the extension points are targeted by function extensions
        const hasFunctionTargets = extensions.extensionPoints.some((ep) => {
          // Check if this extension point is targeted by any function extensions
          return Object.values(pluginData).some((otherPlugin) => {
            const otherExtensions = otherPlugin.extensions;
            return (
              otherExtensions.addedFunctions &&
              otherExtensions.addedFunctions.some((function_) => function_.targets && function_.targets.includes(ep.id))
            );
          });
        });

        if (hasFunctionTargets) {
          contentConsumers.add(pluginId);
        }
      }
    }
  });

  // For both modes, also check if grafana-core is referenced anywhere and add it
  // This handles cases where grafana-core might be referenced but not defined as a plugin
  if (mode === 'extensionpoint' || mode === 'addedlinks' || mode === 'addedcomponents' || mode === 'addedfunctions') {
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
          (Array.isArray(ext.targets) ? ext.targets : [ext.targets]).forEach((target: string) => {
            if (target.includes('grafana-core')) {
              contentConsumers.add('grafana-core');
            }
          });
        }
      });
    });
  }

  // In exposed components mode, also include all consumers found in the processed graph data
  if (mode === 'exposedComponents') {
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

  // Add grafana-core for extension point mode since it's not declared in data.json
  if (mode === 'extensionpoint') {
    contentConsumers.add('grafana-core');
  }

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
 * @param mode - Visualization mode: 'exposedComponents', 'extensionpoint', 'addedlinks', 'addedcomponents', or 'addedfunctions'
 * @returns Sorted array of plugin IDs that are active content consumers
 */
export const getActiveContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (activeConsumersCache.has(mode)) {
    return activeConsumersCache.get(mode)!;
  }

  const activeConsumers = new Set<string>();
  const pluginData = getPluginData();

  if (mode === 'exposedComponents') {
    // In exposed components mode, active consumers are plugins that actually depend on components that exist
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
          visualizationMode: 'exposedComponents',
          selectedContentProviders: [],
          selectedContentConsumers: [],
          selectedContentConsumersForExtensionPoint: [],
          selectedExtensionPoints: [],
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
  } else if (mode === 'addedlinks') {
    // In added links mode, active consumers are plugins with extension points that have link providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with link extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with link extensions
        const hasLinkProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedLinks || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasLinkProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  } else if (mode === 'addedcomponents') {
    // In added components mode, active consumers are plugins with extension points that have component providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with component extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with component extensions
        const hasComponentProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedComponents || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasComponentProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
  } else if (mode === 'addedfunctions') {
    // In added functions mode, active consumers are plugins with extension points that have function providers
    Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
      const extensions = pluginInfo.extensions;

      // Check if any other plugin targets this plugin's extension points with function extensions
      if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
        const extensionPointIds = extensions.extensionPoints.map((ep) => ep.id);

        // Check if any other plugin targets these extension points with function extensions
        const hasFunctionProviders = Object.values(pluginData).some((otherPlugin) => {
          const otherExtensions = otherPlugin.extensions;
          return (otherExtensions.addedFunctions || []).some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
        });

        if (hasFunctionProviders) {
          activeConsumers.add(pluginId);
        }
      }
    });
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
          ].some((item) =>
            (Array.isArray(item.targets) ? item.targets : [item.targets]).some((target: string) =>
              extensionPointIds.includes(target)
            )
          );
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

/**
 * Gets all available extension point IDs for the extension point mode.
 *
 * @returns Sorted array of extension point IDs
 */
export const getAvailableExtensionPoints = (): string[] => {
  if (availableExtensionPointsCache.has('extensionpoint')) {
    return availableExtensionPointsCache.get('extensionpoint')!;
  }

  const extensionPoints = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;
    if (extensions.extensionPoints && extensions.extensionPoints.length > 0) {
      extensions.extensionPoints.forEach((ep) => {
        if (ep && ep.id && ep.id.trim() !== '') {
          extensionPoints.add(ep.id);
        }
      });
    }
  });

  // Add Grafana core extension points since they're not declared in data.json
  const grafanaCoreExtensionPoints = [
    'grafana/alerting/instance/action',
    'grafana/alerting/home',
    'grafana/alerting/alertingrule/action',
    'grafana/alerting/recordingrule/action',
    'grafana/alerting/alertingrule/queryeditor',
    'grafana/commandpalette/action',
    'grafana/dashboard/panel/menu',
    'grafana/datasources/config',
    'grafana/datasources/config/actions',
    'grafana/datasources/config/error-status',
    'grafana/datasources/config/status',
    'grafana/explore/toolbar/action',
    'grafana/user/profile/tab',
    'grafana/traceview/details',
    'grafana/traceview/header/actions',
    'grafana/query-editor-row/adaptivetelemetry/v1',
    'grafana/traceview/resource-attributes',
    'grafana/logsview/resource-attributes',
    'grafana/app/chrome/v1',
    'grafana/extension-sidebar/v0-alpha',
  ];

  grafanaCoreExtensionPoints.forEach((ep) => extensionPoints.add(ep));

  const result = Array.from(extensionPoints).sort();
  availableExtensionPointsCache.set('extensionpoint', result);
  return result;
};

/**
 * Gets all available extension IDs for the extension point mode.
 *
 * @returns Sorted array of extension IDs
 */
export const getAvailableExtensions = (): string[] => {
  if (availableExtensionsCache.has('extensionpoint')) {
    return availableExtensionsCache.get('extensionpoint')!;
  }

  const extensions = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const pluginExtensions = pluginInfo.extensions;
    if (!pluginExtensions) {
      return;
    }

    // Check added links
    if (hasAddedLinksProperty(pluginExtensions) && pluginExtensions.addedLinks.length > 0) {
      pluginExtensions.addedLinks.forEach((link) => {
        if (isExtensionObject(link) && link.targets) {
          const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-link-${target}-${link.title || 'Link Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }

    // Check added components
    if (hasAddedComponentsProperty(pluginExtensions) && pluginExtensions.addedComponents.length > 0) {
      pluginExtensions.addedComponents.forEach((component) => {
        if (isExtensionObject(component) && component.targets) {
          const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-component-${target}-${component.title || 'Component Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }

    // Check added functions
    if (hasAddedFunctionsProperty(pluginExtensions) && pluginExtensions.addedFunctions.length > 0) {
      pluginExtensions.addedFunctions.forEach((func) => {
        if (isExtensionObject(func) && func.targets) {
          const targets = Array.isArray(func.targets) ? func.targets : [func.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-function-${target}-${func.title || 'Function Extension'}`.replace(
                /[^a-zA-Z0-9-]/g,
                '-'
              );
              extensions.add(extensionId);
            }
          });
        }
      });
    }
  });

  const result = Array.from(extensions).sort();
  availableExtensionsCache.set('extensionpoint', result);
  return result;
};

// Create sample data for demonstration that matches the new data format
export const createSampleData = (): GraphData => {
  // This will now use the actual data from data.json
  return processPluginDataToGraph(getDefaultOptions());
};

export const getDefaultOptions = (): PanelOptions => ({
  // Visualization mode
  visualizationMode: 'addedlinks', // Default to 'addedlinks' mode

  showDependencyTypes: true,
  showDescriptions: false, // Hidden by default
  layoutType: 'hierarchical',

  // Filtering options
  selectedContentProviders: [], // Empty array means all providers are selected
  selectedContentConsumers: [], // Empty array means all consumers are selected
  selectedContentConsumersForExtensionPoint: [], // Empty array means all content consumers are selected in extension point mode
  selectedExtensionPoints: [], // Will be populated with all available extension points by default

  // Color options for extension types
  linkExtensionColor: '#37872d', // Green for link extensions
  componentExtensionColor: '#ff9900', // Orange for component extensions
  functionExtensionColor: '#e02f44', // Red for function extensions
});
