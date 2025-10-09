import { AppPluginConfig } from '@grafana/data';
import { t } from '@grafana/i18n';

import { ExposedComponent, GraphData, PanelOptions, PluginDependency, PluginNode } from '../../types';
import { getDisplayName, getPluginType } from '../helpers/pluginHelpers';

const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

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
 * @param pluginData - Raw plugin data from data.json
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
