/**
 * Content Provider Query Functions
 *
 * Functions for querying content provider plugins based on visualization mode.
 */

import { getPluginData } from './dataAccess';
import { getCachedAvailableProviders, setCachedAvailableProviders } from './queryCache';
import { hasAddedComponentsProperty, hasAddedFunctionsProperty, hasAddedLinksProperty } from './typeGuards';

/**
 * Gets all available content provider plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'exposedComponents' (plugins that expose components), 'extensionpoint' (plugins that provide extensions), 'addedlinks' (plugins that add link extensions), 'addedcomponents' (plugins that add component extensions), or 'addedfunctions' (plugins that add function extensions)
 * @returns Sorted array of plugin IDs that act as content providers
 */
export const getAvailableContentProviders = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (getCachedAvailableProviders(mode)) {
    return getCachedAvailableProviders(mode)!;
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
        extensions.extensions &&
        extensions.extensions.length > 0 &&
        extensions.extensions.some((ext) => ext && ext.id && ext.id.trim() !== '');

      if (providesExtensions) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content providers are plugins that add link extensions
      if (hasAddedLinksProperty(extensions) && extensions.addedLinks && extensions.addedLinks.length > 0) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content providers are plugins that add component extensions
      if (
        hasAddedComponentsProperty(extensions) &&
        extensions.addedComponents &&
        extensions.addedComponents.length > 0
      ) {
        contentProviders.add(pluginId);
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content providers are plugins that add function extensions
      if (hasAddedFunctionsProperty(extensions) && extensions.addedFunctions && extensions.addedFunctions.length > 0) {
        contentProviders.add(pluginId);
      }
    }
  });

  const result = Array.from(contentProviders).sort();
  setCachedAvailableProviders(mode, result);
  return result;
};
