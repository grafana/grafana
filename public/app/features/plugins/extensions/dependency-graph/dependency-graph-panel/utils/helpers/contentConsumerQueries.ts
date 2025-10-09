/**
 * Content Consumer Query Functions
 *
 * Functions for querying content consumer plugins based on visualization mode.
 */

import { ExposedComponent } from '../../types';

import { getPluginData } from './dataAccess';
import {
  getCachedActiveConsumers,
  getCachedAvailableConsumers,
  setCachedActiveConsumers,
  setCachedAvailableConsumers,
} from './queryCache';
import { hasAddedComponentsProperty, hasAddedFunctionsProperty, hasAddedLinksProperty } from './typeGuards';

/**
 * Gets all available content consumer plugin IDs for the specified visualization mode.
 *
 * @param mode - Visualization mode: 'exposedComponents' (plugins that consume exposed components), 'extensionpoint' (plugins that consume extensions), 'addedlinks' (plugins that consume link extensions), 'addedcomponents' (plugins that consume component extensions), or 'addedfunctions' (plugins that consume function extensions)
 * @returns Sorted array of plugin IDs that act as content consumers
 */
export const getAvailableContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks'
): string[] => {
  if (getCachedAvailableConsumers(mode)) {
    return getCachedAvailableConsumers(mode)!;
  }

  const contentConsumers = new Set<string>();
  const pluginData = getPluginData();

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    if (mode === 'exposedComponents') {
      // In expose mode, content consumers are plugins that consume exposed components
      const consumesComponents =
        extensions.exposedComponents &&
        extensions.exposedComponents.length > 0 &&
        extensions.exposedComponents.some((comp) => comp && comp.consumers && comp.consumers.length > 0);

      if (consumesComponents) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // In extension point mode, content consumers are plugins that consume extensions
      const consumesExtensions =
        extensions.extensions &&
        extensions.extensions.length > 0 &&
        extensions.extensions.some((ext) => ext && ext.consumers && ext.consumers.length > 0);

      if (consumesExtensions) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // In added links mode, content consumers are plugins that consume link extensions
      if (hasAddedLinksProperty(extensions) && extensions.addedLinks && extensions.addedLinks.length > 0) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'addedcomponents') {
      // In added components mode, content consumers are plugins that consume component extensions
      if (
        hasAddedComponentsProperty(extensions) &&
        extensions.addedComponents &&
        extensions.addedComponents.length > 0
      ) {
        contentConsumers.add(pluginId);
      }
    } else if (mode === 'addedfunctions') {
      // In added functions mode, content consumers are plugins that consume function extensions
      if (hasAddedFunctionsProperty(extensions) && extensions.addedFunctions && extensions.addedFunctions.length > 0) {
        contentConsumers.add(pluginId);
      }
    }
  });

  const result = Array.from(contentConsumers).sort();
  setCachedAvailableConsumers(mode, result);
  return result;
};

/**
 * Gets all active content consumer plugin IDs for the specified visualization mode.
 * Active consumers are those that actually consume content from the selected providers.
 *
 * @param mode - Visualization mode
 * @param selectedProviders - Array of selected content provider plugin IDs
 * @returns Sorted array of plugin IDs that actively consume content
 */
export const getActiveContentConsumers = (
  mode: 'exposedComponents' | 'extensionpoint' | 'addedlinks' | 'addedcomponents' | 'addedfunctions' = 'addedlinks',
  selectedProviders: string[] = []
): string[] => {
  const cacheKey = `${mode}-${selectedProviders.sort().join(',')}`;
  if (getCachedActiveConsumers(cacheKey)) {
    return getCachedActiveConsumers(cacheKey)!;
  }

  const activeConsumers = new Set<string>();
  const pluginData = getPluginData();

  if (selectedProviders.length === 0) {
    // If no providers are selected, return all available consumers
    return getAvailableContentConsumers(mode);
  }

  Object.entries(pluginData).forEach(([pluginId, pluginInfo]) => {
    const extensions = pluginInfo.extensions;

    if (mode === 'exposedComponents') {
      // Check if this plugin consumes components from any selected provider
      const consumesFromSelectedProviders =
        extensions.exposedComponents &&
        extensions.exposedComponents.length > 0 &&
        extensions.exposedComponents.some((comp) => {
          if (!comp || !comp.consumers) {
            return false;
          }
          return comp.consumers.some((consumerId) => selectedProviders.includes(consumerId));
        });

      if (consumesFromSelectedProviders) {
        activeConsumers.add(pluginId);
      }
    } else if (mode === 'extensionpoint') {
      // Check if this plugin consumes extensions from any selected provider
      const consumesFromSelectedProviders =
        extensions.extensions &&
        extensions.extensions.length > 0 &&
        extensions.extensions.some((ext) => {
          if (!ext || !ext.consumers) {
            return false;
          }
          return ext.consumers.some((consumerId) => selectedProviders.includes(consumerId));
        });

      if (consumesFromSelectedProviders) {
        activeConsumers.add(pluginId);
      }
    } else if (mode === 'addedlinks') {
      // For added links mode, check if this plugin has link extensions that target selected providers
      if (hasAddedLinksProperty(extensions) && extensions.addedLinks && extensions.addedLinks.length > 0) {
        const hasLinksToSelectedProviders = extensions.addedLinks.some((link) => {
          if (!link || !link.target) {
            return false;
          }
          return selectedProviders.includes(link.target);
        });

        if (hasLinksToSelectedProviders) {
          activeConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedcomponents') {
      // For added components mode, check if this plugin has component extensions that target selected providers
      if (
        hasAddedComponentsProperty(extensions) &&
        extensions.addedComponents &&
        extensions.addedComponents.length > 0
      ) {
        const hasComponentsToSelectedProviders = extensions.addedComponents.some((comp) => {
          if (!comp || !comp.target) {
            return false;
          }
          return selectedProviders.includes(comp.target);
        });

        if (hasComponentsToSelectedProviders) {
          activeConsumers.add(pluginId);
        }
      }
    } else if (mode === 'addedfunctions') {
      // For added functions mode, check if this plugin has function extensions that target selected providers
      if (hasAddedFunctionsProperty(extensions) && extensions.addedFunctions && extensions.addedFunctions.length > 0) {
        const hasFunctionsToSelectedProviders = extensions.addedFunctions.some((func) => {
          if (!func || !func.target) {
            return false;
          }
          return selectedProviders.includes(func.target);
        });

        if (hasFunctionsToSelectedProviders) {
          activeConsumers.add(pluginId);
        }
      }
    }
  });

  const result = Array.from(activeConsumers).sort();
  setCachedActiveConsumers(cacheKey, result);
  return result;
};
