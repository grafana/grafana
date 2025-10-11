/**
 * Node and Dependency Creation for Extension Point Processing
 *
 * Handles creation of nodes and dependencies for the extension point graph.
 */

import { AppPluginConfig } from '@grafana/data';

import { Extension, ExtensionPoint, PluginDependency, PluginNode } from '../../../types';

import { FilterSetup } from './filterSetup';

/**
 * Creates nodes for the extension point graph
 */
export function createNodes(
  pluginData: Record<string, AppPluginConfig>,
  extensions: Map<string, Extension>,
  extensionPoints: Map<string, ExtensionPoint>,
  filters: FilterSetup
): Map<string, PluginNode> {
  const nodes: Map<string, PluginNode> = new Map();

  // Create nodes for plugins that provide extensions
  extensions.forEach((extension) => {
    const pluginId = extension.providingPlugin;
    if (!nodes.has(pluginId)) {
      const pluginInfo = pluginData[pluginId];
      if (pluginInfo) {
        nodes.set(pluginId, {
          id: pluginId,
          name: pluginInfo.name || pluginId,
          type: pluginInfo.type || 'app',
          version: pluginInfo.info?.version || 'unknown',
          description: pluginInfo.info?.description || '',
        });
      }
    }
  });

  // Create nodes for plugins that define extension points
  extensionPoints.forEach((extensionPoint) => {
    const pluginId = extensionPoint.definingPlugin;
    if (!nodes.has(pluginId)) {
      const pluginInfo = pluginData[pluginId];
      if (pluginInfo) {
        nodes.set(pluginId, {
          id: pluginId,
          name: pluginInfo.name || pluginId,
          type: pluginInfo.type || 'app',
          version: pluginInfo.info?.version || 'unknown',
          description: pluginInfo.info?.description || '',
        });
      }
    }
  });

  return nodes;
}

/**
 * Creates dependencies for the extension point graph
 */
export function createDependencies(
  extensions: Map<string, Extension>,
  extensionPoints: Map<string, ExtensionPoint>
): PluginDependency[] {
  const dependencies: PluginDependency[] = [];

  // Create dependencies from extensions to their target extension points
  extensions.forEach((extension) => {
    const targetExtensionPoint = extensionPoints.get(extension.targetExtensionPoint);
    if (targetExtensionPoint) {
      dependencies.push({
        from: extension.providingPlugin,
        to: targetExtensionPoint.definingPlugin,
        type: 'extension',
        label: `${extension.extensionType}: ${extension.title}`,
        extensionType: extension.extensionType,
        extensionId: extension.id,
        targetExtensionPoint: extension.targetExtensionPoint,
      });
    }
  });

  return dependencies;
}
