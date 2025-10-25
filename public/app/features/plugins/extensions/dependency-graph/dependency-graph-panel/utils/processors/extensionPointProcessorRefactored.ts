/**
 * Extension Point Processor (Refactored)
 *
 * Main entry point for extension point processing. This file now imports
 * from focused modules for better organization and maintainability.
 */

import { AppPluginConfig } from '@grafana/data';

import { GraphData, PanelOptions } from '../../types';

import { collectExtensions } from './extensionPoint/extensionCollection';
import { addMissingExtensionPoints, collectExplicitExtensionPoints } from './extensionPoint/extensionPointCollection';
import { setupFilters } from './extensionPoint/filterSetup';
import { createDependencies, createNodes } from './extensionPoint/nodeAndDependencyCreation';

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

  // Setup filters
  const filters = setupFilters(options);

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExtensionPointGraph - selectedExtensionPoints:', filters.selectedExtensionPoints);
    console.log('processPluginDataToExtensionPointGraph - selectedContentProviders:', filters.selectedContentProviders);
    console.log(
      'processPluginDataToExtensionPointGraph - selectedContentConsumersForExtensionPoint:',
      filters.selectedContentConsumersForExtensionPoint
    );
    console.log(
      'processPluginDataToExtensionPointGraph - shouldFilterExtensionPoints:',
      filters.shouldFilterExtensionPoints
    );
    console.log(
      'processPluginDataToExtensionPointGraph - shouldFilterContentProviders:',
      filters.shouldFilterContentProviders
    );
    console.log(
      'processPluginDataToExtensionPointGraph - shouldFilterContentConsumersForExtensionPoint:',
      filters.shouldFilterContentConsumersForExtensionPoint
    );
  }

  // Collect extension points
  const extensionPoints = collectExplicitExtensionPoints(pluginData, filters);
  addMissingExtensionPoints(extensionPoints, filters);

  // Collect extensions
  const extensions = collectExtensions(pluginData, filters);

  // Create nodes and dependencies
  const nodes = createNodes(pluginData, extensions, extensionPoints, filters);
  const dependencies = createDependencies(extensions, extensionPoints);

  if (ENABLE_DEBUG_LOGS) {
    console.log('processPluginDataToExtensionPointGraph - final results:', {
      nodesCount: nodes.size,
      dependenciesCount: dependencies.length,
      extensionPointsCount: extensionPoints.size,
      extensionsCount: extensions.size,
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    dependencies,
    extensionPoints: Array.from(extensionPoints.values()),
    extensions: Array.from(extensions.values()),
    exposedComponents: [], // Not used in extension point mode
  };
};
