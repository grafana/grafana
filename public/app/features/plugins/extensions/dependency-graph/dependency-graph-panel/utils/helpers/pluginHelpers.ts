import { AppPluginConfig } from '@grafana/data';
import { t } from '@grafana/i18n';

import { PluginNode } from '../../types';

// Memoized helper functions for better performance
const displayNameCache = new Map<string, string>();
const pluginTypeCache = new Map<string, PluginNode['type']>();

/**
 * Gets a human-readable display name for a plugin ID
 */
export const getDisplayName = (pluginId: string): string => {
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

/**
 * Determines the plugin type based on the plugin ID
 */
export const getPluginType = (pluginId: string): PluginNode['type'] => {
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

/**
 * Helper function to determine extension point type based on what extensions target it
 */
export const determineExtensionPointType = (
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
        if (extensions.addedLinks && extensions.addedLinks.length > 0) {
          extensions.addedLinks.forEach((link) => {
            if (link && link.targets) {
              const targets = Array.isArray(link.targets) ? link.targets : [link.targets];
              if (targets.includes(extensionPointId)) {
                types.add('link');
              }
            }
          });
        }

        // Check added components
        if (extensions.addedComponents && extensions.addedComponents.length > 0) {
          extensions.addedComponents.forEach((component) => {
            if (component && component.targets) {
              const targets = Array.isArray(component.targets) ? component.targets : [component.targets];
              if (targets.includes(extensionPointId)) {
                types.add('component');
              }
            }
          });
        }

        // Check added functions
        if (extensions.addedFunctions && extensions.addedFunctions.length > 0) {
          extensions.addedFunctions.forEach((func) => {
            if (func && func.targets) {
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

/**
 * Helper function to find the defining plugin and extension point details for a target
 */
export const findExtensionPointDetails = (
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
