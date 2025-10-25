import { AppPluginConfig } from '@grafana/data';
import { t } from '@grafana/i18n';

import { ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../../types';
import {
  determineExtensionPointType,
  findExtensionPointDetails,
  getDisplayName,
  getPluginType,
} from '../helpers/pluginHelpers';

const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

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
export const processPluginDataToAddedLinksGraph = (
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
            from: pluginId,
            to: target,
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
    filteredDependencies = dependencies.filter((dep) => options.selectedContentProviders.includes(dep.from));

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
      const extensionPoint = filteredExtensionPoints.find((ep) => ep.id === dep.to);
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
  filteredDependencies = filteredDependencies.filter((dep) => remainingExtensionPointIds.has(dep.to));

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
