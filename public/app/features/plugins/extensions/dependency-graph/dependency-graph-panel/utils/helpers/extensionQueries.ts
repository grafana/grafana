/**
 * Extension and Extension Point Query Functions
 *
 * Functions for querying extension points and extensions.
 */

import { getPluginData } from './dataAccess';
import {
  getCachedAvailableExtensionPoints,
  getCachedAvailableExtensions,
  setCachedAvailableExtensionPoints,
  setCachedAvailableExtensions,
} from './queryCache';
import {
  hasAddedComponentsProperty,
  hasAddedFunctionsProperty,
  hasAddedLinksProperty,
  isExtensionObject,
} from './typeGuards';

/**
 * Gets all available extension point IDs.
 *
 * @returns Sorted array of extension point IDs
 */
export const getAvailableExtensionPoints = (): string[] => {
  if (getCachedAvailableExtensionPoints()) {
    return getCachedAvailableExtensionPoints()!;
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

  const result = Array.from(extensionPoints).sort();
  setCachedAvailableExtensionPoints(result);
  return result;
};

/**
 * Gets all available extension IDs.
 *
 * @returns Sorted array of extension IDs
 */
export const getAvailableExtensions = (): string[] => {
  if (getCachedAvailableExtensions()) {
    return getCachedAvailableExtensions()!;
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
      pluginExtensions.addedComponents.forEach((comp) => {
        if (isExtensionObject(comp) && comp.targets) {
          const targets = Array.isArray(comp.targets) ? comp.targets : [comp.targets];
          targets.forEach((target: string) => {
            if (target && target.trim() !== '') {
              const extensionId = `${pluginId}-component-${target}-${comp.title || 'Component Extension'}`.replace(
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
  setCachedAvailableExtensions(result);
  return result;
};
