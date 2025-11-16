import { AppPluginConfig } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Extension, ExtensionPoint, GraphData, PanelOptions, PluginDependency, PluginNode } from '../../types';
import { determineExtensionPointType } from '../helpers/pluginHelpers';
import {
  hasAddedComponentsProperty,
  hasAddedFunctionsProperty,
  hasAddedLinksProperty,
  hasDescriptionProperty,
  hasExtensionPointsProperty,
  isExtensionObject,
  isExtensionPointObject,
} from '../helpers/typeGuards';

const ENABLE_DEBUG_LOGS = true; // Set to true for debugging

/**
 * Processes plugin data for "extensionpoint" mode visualization.
 *
 * In extension point mode, the visualization shows:
 * - Extensions (left side): Link, component, and function extensions that extend extension points
 * - Extension Points (right side): The extension points being extended
 * - Arrows: From extensions to their target extension points
 *
 * @param options - Panel options including filtering settings
 * @param pluginData - Raw plugin data from data.json
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
        // For now, we'll create a basic extension point entry
        extensionPoints.set(targetId, {
          id: targetId,
          definingPlugin: 'grafana-core', // Default assumption
          providers: [], // Will be populated later
          extensionType: 'link', // Default assumption
          title: targetId.replace('grafana/', '').replace(/\//g, ' '),
          description: t(
            'extensions.dependency-graph.grafana-core-extension-point',
            'Grafana core extension point: {{epId}}',
            { epId: targetId }
          ),
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
